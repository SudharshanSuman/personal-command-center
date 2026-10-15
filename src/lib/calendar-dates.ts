export type CalendarView = "day" | "week" | "month"

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function getDayRange(date: Date) {
  const start = startOfDay(date)
  return { start, end: addDays(start, 1) }
}

export function getWeekRange(date: Date) {
  const start = startOfDay(date)
  start.setDate(start.getDate() - start.getDay()) // back up to Sunday
  return { start, end: addDays(start, 7) }
}

// The grid always shows full weeks (Sun-Sat), so it typically bleeds into
// the previous/next month at the edges — the range covers that full grid,
// not just the calendar month itself.
export function getMonthGridRange(date: Date) {
  const monthStart = startOfDay(new Date(date.getFullYear(), date.getMonth(), 1))
  const gridStart = addDays(monthStart, -monthStart.getDay())
  const gridEnd = addDays(gridStart, 42)
  return { start: gridStart, end: gridEnd, monthStart }
}

export function getRangeForView(view: CalendarView, date: Date) {
  if (view === "day") return getDayRange(date)
  if (view === "week") return getWeekRange(date)
  const { start, end } = getMonthGridRange(date)
  return { start, end }
}

export function shiftDate(view: CalendarView, date: Date, direction: 1 | -1): Date {
  if (view === "day") return addDays(date, direction)
  if (view === "week") return addDays(date, direction * 7)
  return new Date(date.getFullYear(), date.getMonth() + direction, 1)
}

// Deliberately builds the string from local date components rather than
// `.toISOString()`, which converts to UTC first — for timezones ahead of
// UTC that silently rolls local midnight back to the previous day.
export function toDateParam(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseDateParam(value: string | undefined): Date {
  if (!value) return startOfDay(new Date())
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? startOfDay(new Date()) : parsed
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export { startOfDay, addDays }
