"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/local/auth-context"
import { OnboardingWizard } from "./onboarding-wizard"

function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export default function OnboardingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace("/login")
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  const profile = user.profile
  const initialValues = {
    routine: safeParseJson(profile?.routine, {
      wake: "07:00",
      sleep: "23:00",
      workStart: "09:00",
      workEnd: "17:00",
    }),
    priorities: safeParseJson<string[]>(profile?.priorities, []),
    theme: (profile?.theme as "light" | "dark" | "system") ?? "system",
    notificationsEnabled: profile?.notificationsEnabled ?? true,
    quietHoursStart: profile?.quietHoursStart ?? "22:00",
    quietHoursEnd: profile?.quietHoursEnd ?? "07:00",
    importantDates: safeParseJson<{ label: string; date: string }[]>(profile?.importantDates, []),
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <OnboardingWizard userName={user.name} initialValues={initialValues} />
    </main>
  )
}
