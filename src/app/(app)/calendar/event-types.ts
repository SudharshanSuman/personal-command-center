import type { EventType } from "@/generated/prisma/enums"
import type { RecurrenceRule } from "@/lib/recurrence"

export type EventView = {
  id: string
  title: string
  type: EventType
  startsAt: Date
  endsAt: Date
  allDay: boolean
  location: string | null
  recurrence: RecurrenceRule | null
  taskId: string | null
  taskTitle: string | null
}

export type DueMarker = {
  id: string
  title: string
  date: Date
  kind: "task" | "assessment"
  href: string
}

export type TaskOption = { id: string; title: string }
