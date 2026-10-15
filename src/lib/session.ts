// LOCAL-FIRST session/auth (Capacitor Android build).
//
// The original server build backed sessions with a Session table + httpOnly
// cookie verified in middleware. On a single-device, offline app there is no
// server and no cross-request cookie: "logged in" is simply which local user
// this device is currently using. We keep register/login/logout and bcrypt
// password hashing (a lock screen for the on-device data), but the "session"
// is just the current user's id persisted in localStorage — no server token,
// no expiry sweep, no middleware. See Documentation/AndroidLocalFirst.md.

import { hashPassword, verifyPassword } from "@/lib/auth"
import { createId } from "@/local/id"
import { query, queryOne, run } from "@/local/sqlite"

const SESSION_KEY = "pcc_local_session_user"

export interface LocalProfile {
  id: string
  userId: string
  routine: string | null
  priorities: string | null
  importantDates: string | null
  theme: string
  quietHoursStart: string | null
  quietHoursEnd: string | null
  notificationsEnabled: boolean
  onboardingCompleted: boolean
}

export interface LocalUser {
  id: string
  email: string
  name: string | null
  passwordHash: string
  profile: LocalProfile | null
}

interface UserRow {
  id: string
  email: string
  name: string | null
  passwordHash: string
}
interface ProfileRow {
  id: string
  userId: string
  routine: string | null
  priorities: string | null
  importantDates: string | null
  theme: string
  quietHoursStart: string | null
  quietHoursEnd: string | null
  notificationsEnabled: number
  onboardingCompleted: number
}

function mapProfile(r: ProfileRow | null): LocalProfile | null {
  if (!r) return null
  return {
    ...r,
    notificationsEnabled: !!r.notificationsEnabled,
    onboardingCompleted: !!r.onboardingCompleted,
  }
}

function getSessionUserId(): string | null {
  if (typeof localStorage === "undefined") return null
  return localStorage.getItem(SESSION_KEY)
}

function setSessionUserId(userId: string): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(SESSION_KEY, userId)
}

async function loadUser(userId: string): Promise<LocalUser | null> {
  const u = await queryOne<UserRow>("SELECT id,email,name,passwordHash FROM users WHERE id = ?", [
    userId,
  ])
  if (!u) return null
  const p = await queryOne<ProfileRow>(
    "SELECT * FROM personalization_profiles WHERE userId = ?",
    [userId]
  )
  return { ...u, profile: mapProfile(p) }
}

/** The device's current user (with profile), or null. Used by pages+actions. */
export async function getCurrentUser(): Promise<LocalUser | null> {
  const id = getSessionUserId()
  if (!id) return null
  return loadUser(id)
}

/** Marks this device as logged in as `userId`. */
export async function createSession(userId: string): Promise<void> {
  setSessionUserId(userId)
}

export async function destroySession(): Promise<void> {
  if (typeof localStorage !== "undefined") localStorage.removeItem(SESSION_KEY)
}

// --- registration / login used by the (auth) pages -------------------------

export async function registerLocalUser(input: {
  name?: string | null
  email: string
  password: string
}): Promise<{ ok: true; onboardingCompleted: boolean } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase()
  const existing = await query<UserRow>("SELECT id FROM users WHERE email = ?", [email])
  if (existing.length > 0) {
    return { ok: false, error: "An account with that email already exists." }
  }
  const now = new Date().toISOString()
  const userId = createId()
  const passwordHash = await hashPassword(input.password)
  await run(
    "INSERT INTO users (id,email,passwordHash,name,createdAt,updatedAt) VALUES (?,?,?,?,?,?)",
    [userId, email, passwordHash, input.name?.trim() || null, now, now]
  )
  await run(
    "INSERT INTO personalization_profiles (id,userId,theme,notificationsEnabled,onboardingCompleted,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)",
    [createId(), userId, "system", 1, 0, now, now]
  )
  await createSession(userId)
  return { ok: true, onboardingCompleted: false }
}

export async function loginLocalUser(input: {
  email: string
  password: string
}): Promise<{ ok: true; onboardingCompleted: boolean } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase()
  const u = await queryOne<UserRow>(
    "SELECT id,email,name,passwordHash FROM users WHERE email = ?",
    [email]
  )
  const valid = u ? await verifyPassword(input.password, u.passwordHash) : false
  if (!u || !valid) return { ok: false, error: "Invalid email or password." }
  await createSession(u.id)
  const p = await queryOne<ProfileRow>(
    "SELECT onboardingCompleted FROM personalization_profiles WHERE userId = ?",
    [u.id]
  )
  return { ok: true, onboardingCompleted: !!(p && p.onboardingCompleted) }
}
