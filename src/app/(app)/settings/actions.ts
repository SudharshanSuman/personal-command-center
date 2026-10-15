
import { z } from "zod"
import { revalidatePath } from "@/local/shims/next-cache"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

const CreateReminderSchema = z.object({
  targetType: z.enum(["TASK", "ASSESSMENT"]),
  targetId: z.string(),
  offsetMinutes: z.number().int().min(0).max(60 * 24 * 30),
  message: z.string().trim().max(200).optional(),
})

async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated.")
  return user
}

function revalidateReminderViews() {
  revalidatePath("/settings")
  revalidatePath("/tasks")
  revalidatePath("/assessments")
}

export async function createReminderRuleAction(input: z.infer<typeof CreateReminderSchema>) {
  const user = await requireUser()
  const data = CreateReminderSchema.parse(input)

  if (data.targetType === "TASK") {
    const task = await db.task.findUnique({ where: { id: data.targetId } })
    if (!task || task.userId !== user.id) throw new Error("Task not found.")
    if (!task.dueDate) throw new Error("Set a due date on this task before adding a reminder.")
  } else {
    const assessment = await db.assessment.findUnique({ where: { id: data.targetId } })
    if (!assessment || assessment.userId !== user.id) throw new Error("Assessment not found.")
  }

  await db.reminderRule.create({
    data: {
      userId: user.id,
      targetType: data.targetType,
      taskId: data.targetType === "TASK" ? data.targetId : null,
      assessmentId: data.targetType === "ASSESSMENT" ? data.targetId : null,
      offsetMinutes: data.offsetMinutes,
      message: data.message || null,
    },
  })

  revalidateReminderViews()
}

const ESCALATING_OFFSETS_MINUTES = [60 * 24 * 3, 60 * 24, 0] // 3 days, 1 day, at the time

const EscalatingReminderSchema = z.object({
  targetType: z.enum(["TASK", "ASSESSMENT"]),
  targetId: z.string(),
})

// One-click bundle instead of adding 3-day/1-day/day-of reminders one at a
// time. Skips offsets that already exist on this target so re-running it
// (or running it after manually adding one of the three) doesn't create
// duplicate rows — VISION's "no notification spam" rule applies to the
// data too, not just delivery.
export async function createEscalatingReminderRulesAction(
  input: z.infer<typeof EscalatingReminderSchema>
) {
  const user = await requireUser()
  const data = EscalatingReminderSchema.parse(input)

  if (data.targetType === "TASK") {
    const task = await db.task.findUnique({ where: { id: data.targetId } })
    if (!task || task.userId !== user.id) throw new Error("Task not found.")
    if (!task.dueDate) throw new Error("Set a due date on this task before adding reminders.")
  } else {
    const assessment = await db.assessment.findUnique({ where: { id: data.targetId } })
    if (!assessment || assessment.userId !== user.id) throw new Error("Assessment not found.")
  }

  const existing = await db.reminderRule.findMany({
    where:
      data.targetType === "TASK" ? { taskId: data.targetId } : { assessmentId: data.targetId },
    select: { offsetMinutes: true },
  })
  const existingOffsets = new Set(existing.map((r) => r.offsetMinutes))
  const toCreate = ESCALATING_OFFSETS_MINUTES.filter((m) => !existingOffsets.has(m))

  if (toCreate.length > 0) {
    await db.reminderRule.createMany({
      data: toCreate.map((offsetMinutes) => ({
        userId: user.id,
        targetType: data.targetType,
        taskId: data.targetType === "TASK" ? data.targetId : null,
        assessmentId: data.targetType === "ASSESSMENT" ? data.targetId : null,
        offsetMinutes,
      })),
    })
  }

  revalidateReminderViews()
}

export async function deleteReminderRuleAction(id: string) {
  const user = await requireUser()
  const rule = await db.reminderRule.findUnique({ where: { id } })
  if (!rule || rule.userId !== user.id) throw new Error("Reminder not found.")
  await db.reminderRule.delete({ where: { id } })
  revalidateReminderViews()
}

const AccountSchema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email("Enter a valid email address"),
})

export type AccountInput = z.infer<typeof AccountSchema>

export async function updateAccountAction(input: AccountInput) {
  const user = await requireUser()
  const data = AccountSchema.parse(input)

  try {
    await db.user.update({
      where: { id: user.id },
      data: { name: data.name || null, email: data.email },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (
      (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") ||
      /UNIQUE constraint failed/i.test(msg)
    ) {
      throw new Error("That email is already in use.")
    }
    throw err
  }

  revalidatePath("/settings")
}

// Mirrors onboarding/actions.ts's OnboardingSchema exactly — kept as a
// separate copy since it lives on a different route's server-action file
// and, unlike onboarding's version, must revalidate /settings and stay on
// the page instead of redirecting to /dashboard on success.
const PersonalizationSchema = z.object({
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

export type PersonalizationInput = z.infer<typeof PersonalizationSchema>

export async function updatePersonalizationAction(input: PersonalizationInput) {
  const user = await requireUser()
  const data = PersonalizationSchema.parse(input)

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
    },
  })

  revalidatePath("/settings")
  revalidatePath("/dashboard")
}
