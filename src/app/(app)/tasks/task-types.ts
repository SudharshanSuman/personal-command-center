import type { Priority, TaskStatus } from "@/generated/prisma/enums"
import type { RecurrenceRule } from "@/lib/recurrence"

export type TaskView = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: Priority
  category: string | null
  tags: string[]
  dueDate: Date | null
  progress: number
  estimatedMinutes: number | null
  actualMinutes: number | null
  recurrence: RecurrenceRule | null
  parentTaskId: string | null
  subtasks: TaskView[]
  reminders: { id: string; offsetMinutes: number }[]
}
