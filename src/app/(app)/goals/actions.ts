
import { z } from "zod"
import { revalidatePath } from "@/local/shims/next-cache"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

const GoalInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional(),
  timeframe: z.enum(["SHORT_TERM", "MONTHLY", "QUARTERLY", "YEARLY"]),
  status: z.enum(["ACTIVE", "COMPLETED", "ABANDONED"]),
  targetDate: z.string().optional(),
  progress: z.number().int().min(0).max(100),
})

export type GoalInput = z.infer<typeof GoalInputSchema>

async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated.")
  return user
}

async function requireOwnedGoal(id: string, userId: string) {
  const goal = await db.goal.findUnique({ where: { id } })
  if (!goal || goal.userId !== userId) throw new Error("Goal not found.")
  return goal
}

function revalidateGoalViews() {
  revalidatePath("/goals")
  revalidatePath("/dashboard")
}

function toTargetDate(value: string | undefined): Date | null {
  if (!value) return null
  return new Date(`${value}T00:00:00`)
}

export async function createGoalAction(input: GoalInput) {
  const user = await requireUser()
  const data = GoalInputSchema.parse(input)

  await db.goal.create({
    data: {
      userId: user.id,
      title: data.title,
      description: data.description || null,
      timeframe: data.timeframe,
      status: data.status,
      targetDate: toTargetDate(data.targetDate),
      progress: data.progress,
    },
  })

  revalidateGoalViews()
}

export async function updateGoalAction(id: string, input: GoalInput) {
  const user = await requireUser()
  await requireOwnedGoal(id, user.id)
  const data = GoalInputSchema.parse(input)

  await db.goal.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description || null,
      timeframe: data.timeframe,
      status: data.status,
      targetDate: toTargetDate(data.targetDate),
      progress: data.progress,
    },
  })

  revalidateGoalViews()
}

// Unlinks (does not delete) any tasks pointed at this goal — a task
// shouldn't disappear just because the goal it was filed under did.
export async function deleteGoalAction(id: string) {
  const user = await requireUser()
  await requireOwnedGoal(id, user.id)
  await db.goal.delete({ where: { id } })
  revalidateGoalViews()
}

export async function setTaskGoalAction(taskId: string, goalId: string | null) {
  const user = await requireUser()
  const task = await db.task.findUnique({ where: { id: taskId } })
  if (!task || task.userId !== user.id) throw new Error("Task not found.")
  if (goalId) await requireOwnedGoal(goalId, user.id)

  await db.task.update({ where: { id: taskId }, data: { goalId } })
  revalidateGoalViews()
  revalidatePath("/tasks")
}

const QuickTaskForGoalSchema = z.object({
  goalId: z.string(),
  title: z.string().trim().min(1, "Title is required").max(200),
})

export async function createTaskForGoalAction(input: z.infer<typeof QuickTaskForGoalSchema>) {
  const user = await requireUser()
  const data = QuickTaskForGoalSchema.parse(input)
  await requireOwnedGoal(data.goalId, user.id)

  await db.task.create({
    data: {
      userId: user.id,
      title: data.title,
      status: "TODO",
      priority: "MEDIUM",
      tags: "[]",
      progress: 0,
      goalId: data.goalId,
    },
  })

  revalidateGoalViews()
  revalidatePath("/tasks")
}
