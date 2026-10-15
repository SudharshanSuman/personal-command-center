import bcrypt from "bcryptjs"

// Foundational password hashing helpers for the bcrypt + session-cookie auth
// approach (see Documentation/Architecture.md). Session issuance/verification
// lands with the foundation build (T4).

const SALT_ROUNDS = 12

export async function hashPassword(plainTextPassword: string): Promise<string> {
  return bcrypt.hash(plainTextPassword, SALT_ROUNDS)
}

export async function verifyPassword(
  plainTextPassword: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(plainTextPassword, passwordHash)
}
