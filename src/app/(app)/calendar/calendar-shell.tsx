"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Plus, MapPin, Pin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  addDays,
  getMonthGridRange,
  isSameDay,
  shiftDate,
  toDateParam,
  type CalendarView,
} from "@/lib/calendar-dates"
import { describeRecurrenceRule } from "@/lib/recurrence"
import { EventFormDialog } from "./event-form-dialog"
import type { DueMarker, EventView, TaskOption } from "./event-types"

const EVENT_TYPE_LABEL: Record<EventView["type"], string> = {
  EVENT: "Event",
  TIME_BLOCK: "Time block",
  STUDY_SESSION: "Study session",
  HABIT_BLOCK: "Habit",
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

function formatDayHeading(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
}

export function CalendarShell({
  view,
  anchorDate,
  events,
  dueMarkers,
  taskOptions,
}: {
  view: CalendarView
  anchorDate: string
  events: EventView[]
  dueMarkers: DueMarker[]
  taskOptions: TaskOption[]
}) {
  const router = useRouter()
  const anchor = new Date(anchorDate)

  function navigate(nextView: CalendarView, nextDate: Date) {
    router.push(`/calendar?view=${nextView}&date=${toDateParam(nextDate)}`)
  }

  function itemsForDay(day: Date) {
    const dayEvents = events.filter((e) => isSameDay(e.startsAt, day))
    const dayDue = dueMarkers.filter((d) => isSameDay(d.date, day))
    return { dayEvents, dayDue }
  }

  return (
    <div className="flex flex-col gap-4 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">
            {view === "month"
              ? anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
              : formatDayHeading(anchor)}
          </p>
        </div>
        <EventFormDialog
          mode="create"
          anchorDate={anchor}
          taskOptions={taskOptions}
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New event
            </Button>
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1 rounded-md border p-1">
          {(["day", "week", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => navigate(v, anchor)}
              className={cn(
                "rounded px-3 py-1 text-sm capitalize",
                v === view
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous"
            onClick={() => navigate(view, shiftDate(view, anchor, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(view, new Date())}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next"
            onClick={() => navigate(view, shiftDate(view, anchor, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {view === "month" && (
        <MonthGrid anchor={anchor} itemsForDay={itemsForDay} navigate={navigate} />
      )}
      {view === "week" && (
        <AgendaDays
          days={Array.from({ length: 7 }, (_, i) =>
            addDays(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay()), i)
          )}
          itemsForDay={itemsForDay}
          taskOptions={taskOptions}
        />
      )}
      {view === "day" && (
        <AgendaDays days={[anchor]} itemsForDay={itemsForDay} taskOptions={taskOptions} />
      )}
    </div>
  )
}

function MonthGrid({
  anchor,
  itemsForDay,
  navigate,
}: {
  anchor: Date
  itemsForDay: (day: Date) => { dayEvents: EventView[]; dayDue: DueMarker[] }
  navigate: (view: CalendarView, date: Date) => void
}) {
  const { start, monthStart } = getMonthGridRange(anchor)
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  const today = new Date()

  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
        <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">
          {d}
        </div>
      ))}
      {days.map((day) => {
        const { dayEvents, dayDue } = itemsForDay(day)
        const inMonth = day.getMonth() === monthStart.getMonth()
        const isToday = isSameDay(day, today)
        const items = [...dayEvents, ...dayDue].slice(0, 3)
        const overflow = dayEvents.length + dayDue.length - items.length

        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => navigate("day", day)}
            className={cn(
              "flex min-h-24 flex-col gap-1 bg-background p-1.5 text-left align-top",
              !inMonth && "bg-muted/40 text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                isToday && "bg-primary text-primary-foreground"
              )}
            >
              {day.getDate()}
            </span>
            <div className="flex flex-col gap-0.5">
              {items.map((item) => (
                <span
                  key={item.id}
                  className={cn(
                    "truncate rounded px-1 text-[11px]",
                    "kind" in item ? "bg-secondary text-secondary-foreground" : "bg-accent text-accent-foreground"
                  )}
                >
                  {item.title}
                </span>
              ))}
              {overflow > 0 && (
                <span className="text-[11px] text-muted-foreground">+{overflow} more</span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function AgendaDays({
  days,
  itemsForDay,
  taskOptions,
}: {
  days: Date[]
  itemsForDay: (day: Date) => { dayEvents: EventView[]; dayDue: DueMarker[] }
  taskOptions: TaskOption[]
}) {
  return (
    <div className={cn("grid gap-4", days.length > 1 ? "sm:grid-cols-7" : "sm:grid-cols-1")}>
      {days.map((day) => {
        const { dayEvents, dayDue } = itemsForDay(day)
        return (
          <div key={day.toISOString()} className="flex flex-col gap-2 rounded-md border p-3">
            <p className="text-sm font-medium">
              {day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </p>
            {dayEvents.length === 0 && dayDue.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing scheduled.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {dayEvents.map((event) => (
                  <li key={event.id}>
                    <EventFormDialog
                      mode="edit"
                      event={event}
                      taskOptions={taskOptions}
                      trigger={
                        <button type="button" className="w-full rounded-md border p-2 text-left text-sm hover:bg-accent">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{event.title}</span>
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {EVENT_TYPE_LABEL[event.type]}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {event.allDay
                              ? "All day"
                              : `${formatTime(event.startsAt)} – ${formatTime(event.endsAt)}`}
                          </p>
                          {event.location && (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" /> {event.location}
                            </p>
                          )}
                          {event.taskTitle && (
                            <p className="text-xs text-muted-foreground">Linked: {event.taskTitle}</p>
                          )}
                          {event.recurrence && (
                            <Badge variant="secondary" className="mt-1 text-[10px]">
                              {describeRecurrenceRule(event.recurrence)}
                            </Badge>
                          )}
                        </button>
                      }
                    />
                  </li>
                ))}
                {dayDue.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-1 rounded-md border border-dashed p-2 text-xs text-muted-foreground hover:bg-accent"
                    >
                      <Pin className="h-3 w-3 shrink-0" />
                      {item.kind === "task" ? "Due: " : "Assessment: "}
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
