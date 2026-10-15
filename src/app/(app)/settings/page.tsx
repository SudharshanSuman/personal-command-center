"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/db"
import { destroySession } from "@/lib/session"
import { useAuth } from "@/local/auth-context"
import { useLocalData } from "@/local/use-local-data"
import { computeNominalFireTime, computeEffectiveFireTime, OFFSET_PRESETS } from "@/lib/reminders"
import { UpcomingReminders, type UpcomingReminderItem } from "./upcoming-reminders"
import { ProfileFormDialog } from "./profile-form-dialog"
import { PersonalizationFormDialog } from "./personalization-form-dialog"
import type { PersonalizationInput } from "./actions"

function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function offsetLabel(minutes: number): string {
  const preset = OFFSET_PRESETS.find((p) => p.minutes === minutes)
  if (preset) return preset.label
  if (minutes % (60 * 24) === 0) return `${minutes / (60 * 24)} day(s) before`
  if (minutes % 60 === 0) return `${minutes / 60} hour(s) before`
  return `${minutes} minutes before`
}

export default function SettingsPage() {
  const { user, refresh } = useAuth()
  const router = useRouter()

  async function handleLogout() {
    await destroySession()
    await refresh()
    router.replace("/login")
  }

  const { data, loading } = useLocalData(async () => {
    if (!user) return null
    const profile = user.profile

    const reminderRules = await db.reminderRule.findMany({
      where: { userId: user.id, dismissedAt: null },
      include: {
        task: { select: { title: true, dueDate: true } },
        assessment: { select: { subject: true, title: true, date: true } },
      },
    })

    const upcomingReminders: UpcomingReminderItem[] = reminderRules
      .map((rule) => {
        const targetAt = rule.task?.dueDate ?? rule.assessment?.date ?? null
        if (!targetAt) return null
        const targetTitle = rule.task
          ? rule.task.title
          : rule.assessment
            ? `${rule.assessment.subject}: ${rule.assessment.title}`
            : "Unknown"
        const nominal = computeNominalFireTime(targetAt, rule.offsetMinutes)
        const { effectiveTime, heldForQuietHours } = computeEffectiveFireTime(
          nominal,
          profile?.quietHoursStart ?? null,
          profile?.quietHoursEnd ?? null
        )
        return {
          id: rule.id,
          targetTitle,
          offsetLabel: offsetLabel(rule.offsetMinutes),
          effectiveTime,
          heldForQuietHours,
        }
      })
      .filter((item): item is UpcomingReminderItem => item !== null)
      .sort((a, b) => a.effectiveTime.getTime() - b.effectiveTime.getTime())

    return { upcomingReminders }
  }, [user?.id])

  if (!user) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  const profile = user.profile
  const priorities = safeParseJson<string[]>(profile?.priorities, [])
  const importantDates = safeParseJson<{ label: string; date: string }[]>(
    profile?.importantDates,
    []
  )

  const personalizationInitialValues: PersonalizationInput = {
    routine: safeParseJson(profile?.routine, {
      wake: "07:00",
      sleep: "23:00",
      workStart: "09:00",
      workEnd: "17:00",
    }),
    priorities,
    theme: (profile?.theme as "light" | "dark" | "system") ?? "system",
    notificationsEnabled: profile?.notificationsEnabled ?? true,
    quietHoursStart: profile?.quietHoursStart ?? "22:00",
    quietHoursEnd: profile?.quietHoursEnd ?? "07:00",
    importantDates,
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Your account and personalization profile.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <p>
            <span className="text-muted-foreground">Name: </span>
            {user.name || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Email: </span>
            {user.email}
          </p>
          <ProfileFormDialog
            name={user.name}
            email={user.email}
            trigger={
              <Button variant="outline" size="sm" className="mt-2 w-fit">
                Edit profile
              </Button>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personalization</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            <span className="text-muted-foreground">Theme: </span>
            {profile?.theme ?? "system"}
          </p>
          <p>
            <span className="text-muted-foreground">Notifications: </span>
            {profile?.notificationsEnabled ? "Enabled" : "Disabled"}
          </p>
          <p>
            <span className="text-muted-foreground">Quiet hours: </span>
            {profile?.quietHoursStart && profile?.quietHoursEnd
              ? `${profile.quietHoursStart} – ${profile.quietHoursEnd}`
              : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Priorities: </span>
            {priorities.length > 0 ? priorities.join(", ") : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Important dates: </span>
            {importantDates.length > 0
              ? importantDates.map((d) => `${d.label} (${d.date})`).join(", ")
              : "—"}
          </p>
          <PersonalizationFormDialog
            initialValues={personalizationInitialValues}
            trigger={
              <Button variant="outline" size="sm" className="mt-2 w-fit">
                Edit personalization
              </Button>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming reminders</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Add reminders from a task or assessment&apos;s edit dialog. Note: this environment
            has no notification delivery mechanism (no browser push, email, or background
            worker) — this list shows when each reminder would fire, computed and
            quiet-hours-aware, ready for a real delivery worker to consume later. Nothing is
            actually sent yet.
          </p>
          {loading || !data ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <UpcomingReminders items={data.upcomingReminders} />
          )}
        </CardContent>
      </Card>

      <Button type="button" variant="destructive" size="sm" className="w-fit" onClick={handleLogout}>
        Log out
      </Button>
    </div>
  )
}
