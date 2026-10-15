
import { z } from "zod"
import { revalidatePath } from "@/local/shims/next-cache"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { setTaskStatusAction, deleteTaskAction } from "@/app/(app)/tasks/actions"
import { toggleHabitLogAction } from "@/app/(app)/habits/actions"

async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated.")
  return user
}

async function requireOwnedTask(id: string, userId: string) {
  const task = await db.task.findUnique({ where: { id } })
  if (!task || task.userId !== userId) throw new Error("Task not found.")
  return task
}

// Thin wrappers around each module's own action so the review checklist can
// reuse the exact same mutation logic (status update, delete, habit log)
// rather than duplicating it, while still revalidating /reviews — the
// underlying actions only know about their own routes.
export async function reviewMarkTaskDoneAction(taskId: string) {
  await setTaskStatusAction(taskId, "DONE")
  revalidatePath("/reviews")
}

export async function reviewCarryTaskAction(taskId: string) {
  const user = await requireUser()
  await requireOwnedTask(taskId, user.id)

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)

  await db.task.update({ where: { id: taskId }, data: { dueDate: tomorrow } })
  revalidatePath("/reviews")
  revalidatePath("/tasks")
  revalidatePath("/calendar")
}

export async function reviewDeleteTaskAction(taskId: string) {
  await deleteTaskAction(taskId)
  revalidatePath("/reviews")
}

export async function reviewLogHabitAction(habitId: string, date: string) {
  await toggleHabitLogAction({ habitId, date })
  revalidatePath("/reviews")
}

const DailyReviewSchema = z.object({
  date: z.string(), // "YYYY-MM-DD", anchor for the day being reviewed
  completedTaskIds: z.array(z.string()).max(200),
  carriedTaskIds: z.array(z.string()).max(200),
  loggedHabitIds: z.array(z.string()).max(200),
  wentWell: z.string().trim().max(2000).optional(),
  needsAttention: z.string().trim().max(2000).optional(),
})

export type DailyReviewInput = z.infer<typeof DailyReviewSchema>

export async function submitDailyReviewAction(input: DailyReviewInput) {
  const user = await requireUser()
  const data = DailyReviewSchema.parse(input)
  const anchor = new Date(`${data.date}T00:00:00`)
  const nextDay = new Date(anchor)
  nextDay.setDate(nextDay.getDate() + 1)

  // "Missed" isn't passed from the client — it's whatever's still open at
  // submit time, computed fresh so it reflects every action taken during
  // the review session rather than a stale snapshot from page load.
  const stillOpen = await db.task.findMany({
    where: {
      userId: user.id,
      dueDate: { gte: anchor, lt: nextDay },
      status: { in: ["TODO", "IN_PROGRESS"] },
    },
    select: { id: true },
  })

  const fields = {
    completedSummary: JSON.stringify({
      taskIds: data.completedTaskIds,
      habitIds: data.loggedHabitIds,
    }),
    missedSummary: JSON.stringify({ taskIds: stillOpen.map((t) => t.id) }),
    carryOver: JSON.stringify({ taskIds: data.carriedTaskIds }),
    wentWell: data.wentWell || null,
    needsAttention: data.needsAttention || null,
  }

  await db.dailyReview.upsert({
    where: { userId_period_date: { userId: user.id, period: "DAILY", date: anchor } },
    create: { userId: user.id, period: "DAILY", date: anchor, ...fields },
    update: fields,
  })

  revalidatePath("/reviews")
  revalidatePath("/dashboard")
}

const PeriodReviewSchema = z.object({
  period: z.enum(["WEEKLY", "MONTHLY"]),
  date: z.string(), // "YYYY-MM-DD", anchor (start of week or month)
  wentWell: z.string().trim().max(2000).optional(),
  needsAttention: z.string().trim().max(2000).optional(),
})

export type PeriodReviewInput = z.infer<typeof PeriodReviewSchema>

export async function submitPeriodReviewAction(input: PeriodReviewInput) {
  const user = await requireUser()
  const data = PeriodReviewSchema.parse(input)
  const anchor = new Date(`${data.date}T00:00:00`)

  const fields = {
    wentWell: data.wentWell || null,
    needsAttention: data.needsAttention || null,
  }

  await db.dailyReview.upsert({
    where: { userId_period_date: { userId: user.id, period: data.period, date: anchor } },
    create: { userId: user.id, period: data.period, date: anchor, ...fields },
    update: fields,
  })

  revalidatePath("/reviews")
}
