
import { z } from "zod"
import { revalidatePath } from "@/local/shims/next-cache"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import {
  RecurrenceRuleSchema,
  computeNextOccurrence,
  stringifyRecurrenceRule,
} from "@/lib/recurrence"

const TaskInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  category: z.string().trim().max(100).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20),
  dueDate: z.string().optional(), // "YYYY-MM-DD" or ""
  progress: z.number().int().min(0).max(100),
  estimatedMinutes: z.number().int().min(0).max(100000).nullable().optional(),
  actualMinutes: z.number().int().min(0).max(100000).nullable().optional(),
  recurrence: RecurrenceRuleSchema.nullable(),
  parentTaskId: z.string().nullable().optional(),
})

export type TaskInput = z.infer<typeof TaskInputSchema>

async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated.")
  return user
}

function toDueDate(value: string | undefined): Date | null {
  if (!value) return null
  return new Date(`${value}T00:00:00`)
}

async function requireOwnedTask(id: string, userId: string) {
  const task = await db.task.findUnique({ where: { id } })
  if (!task || task.userId !== userId) throw new Error("Task not found.")
  return task
}

function revalidateTaskViews() {
  revalidatePath("/tasks")
  revalidatePath("/dashboard")
}

export async function createTaskAction(input: TaskInput) {
  const user = await requireUser()
  const data = TaskInputSchema.parse(input)

  if (data.parentTaskId) {
    await requireOwnedTask(data.parentTaskId, user.id)
  }

  await db.task.create({
    data: {
      userId: user.id,
      title: data.title,
      description: data.description || null,
      status: data.status,
      priority: data.priority,
      category: data.category || null,
      tags: JSON.stringify(data.tags),
      dueDate: toDueDate(data.dueDate),
      progress: data.progress,
      estimatedMinutes: data.estimatedMinutes ?? null,
      actualMinutes: data.actualMinutes ?? null,
      recurrenceRule: stringifyRecurrenceRule(data.recurrence),
      parentTaskId: data.parentTaskId || null,
    },
  })

  revalidateTaskViews()
}

export async function updateTaskAction(id: string, input: TaskInput) {
  const user = await requireUser()
  await requireOwnedTask(id, user.id)
  const data = TaskInputSchema.parse(input)

  await db.task.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description || null,
      status: data.status,
      priority: data.priority,
      category: data.category || null,
      tags: JSON.stringify(data.tags),
      dueDate: toDueDate(data.dueDate),
      progress: data.progress,
      estimatedMinutes: data.estimatedMinutes ?? null,
      actualMinutes: data.actualMinutes ?? null,
      recurrenceRule: stringifyRecurrenceRule(data.recurrence),
    },
  })

  revalidateTaskViews()
}

// Deliberate choice: deleting a task cascades to its subtasks (enforced at
// the DB level via onDelete: Cascade on Task.parentTaskId in schema.prisma)
// rather than orphaning them. A subtask with no parent has no clear home in
// the list view, and "delete the parent, delete the plan under it" matches
// how most task apps behave.
export async function deleteTaskAction(id: string) {
  const user = await requireUser()
  await requireOwnedTask(id, user.id)
  await db.task.delete({ where: { id } })
  revalidateTaskViews()
}

export async function setTaskStatusAction(id: string, status: TaskInput["status"]) {
  const user = await requireUser()
  const task = await requireOwnedTask(id, user.id)

  await db.task.update({
    where: { id },
    data: {
      status,
      progress: status === "DONE" ? 100 : task.progress,
    },
  })

  if (status === "DONE" && task.recurrenceRule) {
    const rule = RecurrenceRuleSchema.safeParse(JSON.parse(task.recurrenceRule))
    if (rule.success) {
      const nextDueDate = computeNextOccurrence(task.dueDate ?? new Date(), rule.data)
      await db.task.create({
        data: {
          userId: user.id,
          title: task.title,
          description: task.description,
          status: "TODO",
          priority: task.priority,
          category: task.category,
          tags: task.tags,
          dueDate: nextDueDate,
          progress: 0,
          estimatedMinutes: task.estimatedMinutes,
          recurrenceRule: task.recurrenceRule,
          parentTaskId: task.parentTaskId,
          goalId: task.goalId,
          assessmentId: task.assessmentId,
        },
      })
    }
  }

  revalidateTaskViews()
}

const QuickAddSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  dueDate: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
})

export async function quickAddTaskAction(input: z.infer<typeof QuickAddSchema>) {
  const user = await requireUser()
  const data = QuickAddSchema.parse(input)

  await db.task.create({
    data: {
      userId: user.id,
      title: data.title,
      status: "TODO",
      priority: data.priority,
      tags: "[]",
      dueDate: toDueDate(data.dueDate),
      progress: 0,
    },
  })

  revalidateTaskViews()
}
