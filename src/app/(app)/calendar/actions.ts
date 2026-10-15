
import { z } from "zod"
import { revalidatePath } from "@/local/shims/next-cache"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import {
  RecurrenceRuleSchema,
  materializeOccurrences,
  stringifyRecurrenceRule,
} from "@/lib/recurrence"

const EventInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    type: z.enum(["EVENT", "TIME_BLOCK", "STUDY_SESSION", "HABIT_BLOCK"]),
    startsAt: z.string().min(1, "Start time is required"),
    endsAt: z.string().min(1, "End time is required"),
    allDay: z.boolean(),
    location: z.string().trim().max(200).optional(),
    recurrence: RecurrenceRuleSchema.nullable(),
    taskId: z.string().nullable().optional(),
  })
  .refine((data) => new Date(data.endsAt) >= new Date(data.startsAt), {
    message: "End time must be after the start time.",
    path: ["endsAt"],
  })

export type EventInput = z.infer<typeof EventInputSchema>

async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated.")
  return user
}

async function requireOwnedEvent(id: string, userId: string) {
  const event = await db.event.findUnique({ where: { id } })
  if (!event || event.userId !== userId) throw new Error("Event not found.")
  return event
}

function revalidateCalendarViews() {
  revalidatePath("/calendar")
  revalidatePath("/dashboard")
}

export async function createEventAction(input: EventInput) {
  const user = await requireUser()
  const data = EventInputSchema.parse(input)

  if (data.taskId) {
    const task = await db.task.findUnique({ where: { id: data.taskId } })
    if (!task || task.userId !== user.id) throw new Error("Task not found.")
  }

  const start = new Date(data.startsAt)
  const end = new Date(data.endsAt)
  const durationMs = end.getTime() - start.getTime()

  // Recurring events are materialized as independent rows up front (bounded
  // window — see src/lib/recurrence.ts) rather than expanded on the fly, so
  // each occurrence can be edited/deleted individually like a normal event.
  const occurrenceStarts = data.recurrence
    ? materializeOccurrences(start, data.recurrence)
    : [start]

  await db.event.createMany({
    data: occurrenceStarts.map((occurrenceStart) => ({
      userId: user.id,
      title: data.title,
      type: data.type,
      startsAt: occurrenceStart,
      endsAt: new Date(occurrenceStart.getTime() + durationMs),
      allDay: data.allDay,
      location: data.location || null,
      recurrenceRule: stringifyRecurrenceRule(data.recurrence),
      taskId: data.taskId || null,
    })),
  })

  revalidateCalendarViews()
}

export async function updateEventAction(id: string, input: EventInput) {
  const user = await requireUser()
  await requireOwnedEvent(id, user.id)
  const data = EventInputSchema.parse(input)

  if (data.taskId) {
    const task = await db.task.findUnique({ where: { id: data.taskId } })
    if (!task || task.userId !== user.id) throw new Error("Task not found.")
  }

  // Editing only ever touches the single occurrence being edited — it does
  // not re-materialize the recurring series. Simple and predictable; series-
  // wide edits are a fast-follow, not built now.
  await db.event.update({
    where: { id },
    data: {
      title: data.title,
      type: data.type,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
      allDay: data.allDay,
      location: data.location || null,
      taskId: data.taskId || null,
    },
  })

  revalidateCalendarViews()
}

export async function deleteEventAction(id: string) {
  const user = await requireUser()
  await requireOwnedEvent(id, user.id)
  await db.event.delete({ where: { id } })
  revalidateCalendarViews()
}
