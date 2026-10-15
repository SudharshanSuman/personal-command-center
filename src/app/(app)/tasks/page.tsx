"use client"

import { db } from "@/lib/db"
import { useAuth } from "@/local/auth-context"
import { useLocalData } from "@/local/use-local-data"
import { parseRecurrenceRule } from "@/lib/recurrence"
import type { TaskView } from "./task-types"
import { TaskList } from "./task-list"

function toTaskView(task: {
  id: string
  title: string
  description: string | null
  status: TaskView["status"]
  priority: TaskView["priority"]
  category: string | null
  tags: string | null
  dueDate: Date | null
  progress: number
  estimatedMinutes: number | null
  actualMinutes: number | null
  recurrenceRule: string | null
  parentTaskId: string | null
  reminderRules: { id: string; offsetMinutes: number }[]
}): Omit<TaskView, "subtasks"> {
  let tags: string[] = []
  try {
    tags = task.tags ? JSON.parse(task.tags) : []
  } catch {
    tags = []
  }
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    category: task.category,
    tags,
    dueDate: task.dueDate,
    progress: task.progress,
    estimatedMinutes: task.estimatedMinutes,
    actualMinutes: task.actualMinutes,
    recurrence: parseRecurrenceRule(task.recurrenceRule),
    parentTaskId: task.parentTaskId,
    reminders: task.reminderRules,
  }
}

export default function TasksPage() {
  const { user } = useAuth()
  const { data, loading } = useLocalData(async () => {
    if (!user) return null
    const topLevelTasks = await db.task.findMany({
      where: { userId: user.id, parentTaskId: null },
      include: {
        subtasks: {
          orderBy: { createdAt: "asc" },
          include: { reminderRules: { select: { id: true, offsetMinutes: true } } },
        },
        reminderRules: { select: { id: true, offsetMinutes: true } },
      },
      orderBy: { createdAt: "desc" },
    })
    const tasks: TaskView[] = topLevelTasks.map((task) => ({
      ...toTaskView(task),
      subtasks: task.subtasks.map((sub: Parameters<typeof toTaskView>[0]) => ({
        ...toTaskView(sub),
        subtasks: [],
      })),
    }))
    return tasks
  }, [user?.id])

  if (loading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }
  return <TaskList initialTasks={data} />
}
