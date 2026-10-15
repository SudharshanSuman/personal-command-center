"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { db } from "@/lib/db"
import { useAuth } from "@/local/auth-context"
import { useLocalData } from "@/local/use-local-data"
import { parseRecurrenceRule } from "@/lib/recurrence"
import { getRangeForView, parseDateParam, type CalendarView } from "@/lib/calendar-dates"
import { CalendarShell } from "./calendar-shell"
import type { DueMarker, EventView, TaskOption } from "./event-types"

function isCalendarView(value: string | undefined): value is CalendarView {
  return value === "day" || value === "week" || value === "month"
}

function CalendarPageInner() {
  const { user } = useAuth()
  const sp = useSearchParams()
  const viewParam = sp.get("view") ?? undefined
  const dateParam = sp.get("date") ?? undefined
  const view: CalendarView = isCalendarView(viewParam) ? viewParam : "month"
  const anchorDate = parseDateParam(dateParam)

  const { data, loading } = useLocalData(async () => {
    if (!user) return null
    const { start, end } = getRangeForView(view, anchorDate)

    const [events, dueTasks, dueAssessments, taskOptions] = await Promise.all([
      db.event.findMany({
        where: { userId: user.id, startsAt: { lt: end }, endsAt: { gte: start } },
        include: { task: { select: { title: true } } },
        orderBy: { startsAt: "asc" },
      }),
      db.task.findMany({
        where: {
          userId: user.id,
          dueDate: { gte: start, lt: end },
          status: { in: ["TODO", "IN_PROGRESS"] },
        },
        select: { id: true, title: true, dueDate: true },
      }),
      db.assessment.findMany({
        where: { userId: user.id, date: { gte: start, lt: end } },
        select: { id: true, subject: true, title: true, date: true },
      }),
      db.task.findMany({
        where: { userId: user.id, status: { in: ["TODO", "IN_PROGRESS"] } },
        select: { id: true, title: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ])

    const eventViews: EventView[] = events.map((event) => ({
      id: event.id,
      title: event.title,
      type: event.type,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      location: event.location,
      recurrence: parseRecurrenceRule(event.recurrenceRule),
      taskId: event.taskId,
      taskTitle: event.task?.title ?? null,
    }))

    const dueMarkers: DueMarker[] = [
      ...dueTasks
        .filter((t) => t.dueDate)
        .map((t) => ({
          id: `task-${t.id}`,
          title: t.title,
          date: t.dueDate as Date,
          kind: "task" as const,
          href: "/tasks",
        })),
      ...dueAssessments.map((a) => ({
        id: `assessment-${a.id}`,
        title: `${a.subject} — ${a.title}`,
        date: a.date,
        kind: "assessment" as const,
        href: "/assessments",
      })),
    ]

    const taskOptionViews: TaskOption[] = taskOptions.map((t) => ({ id: t.id, title: t.title }))
    return { eventViews, dueMarkers, taskOptionViews }
  }, [user?.id, view, dateParam])

  if (loading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  return (
    <CalendarShell
      view={view}
      anchorDate={anchorDate.toISOString()}
      events={data.eventViews}
      dueMarkers={data.dueMarkers}
      taskOptions={data.taskOptionViews}
    />
  )
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <CalendarPageInner />
    </Suspense>
  )
}
