
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

const OnboardingSchema = z.object({
  routine: z.object({
    wake: z.string(),
    sleep: z.string(),
    workStart: z.string(),
    workEnd: z.string(),
  }),
  priorities: z.array(z.string()).max(10),
  theme: z.enum(["light", "dark", "system"]),
  notificationsEnabled: z.boolean(),
  quietHoursStart: z.string(),
  quietHoursEnd: z.string(),
  importantDates: z
    .array(z.object({ label: z.string().trim().min(1).max(100), date: z.string() }))
    .max(10),
})

export type OnboardingInput = z.infer<typeof OnboardingSchema>

export async function completeOnboardingAction(input: OnboardingInput): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not signed in.")

  const parsed = OnboardingSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid onboarding data.")
  }

  const data = parsed.data

  await db.personalizationProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      routine: JSON.stringify(data.routine),
      priorities: JSON.stringify(data.priorities),
      importantDates: JSON.stringify(data.importantDates),
      theme: data.theme,
      notificationsEnabled: data.notificationsEnabled,
      quietHoursStart: data.quietHoursStart || null,
      quietHoursEnd: data.quietHoursEnd || null,
      onboardingCompleted: true,
    },
    update: {
      routine: JSON.stringify(data.routine),
      priorities: JSON.stringify(data.priorities),
      importantDates: JSON.stringify(data.importantDates),
      theme: data.theme,
      notificationsEnabled: data.notificationsEnabled,
      quietHoursStart: data.quietHoursStart || null,
      quietHoursEnd: data.quietHoursEnd || null,
      onboardingCompleted: true,
    },
  })
}
