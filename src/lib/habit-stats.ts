// Shared by the Habits page and Analytics — VISION.md is explicit that
// streaks alone aren't the success metric, so every habit view surfaces
// both a streak (momentum) and a consistency percentage (reliability).

function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

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

export function computeCurrentStreak(completedDateKeys: Set<string>, today: Date): number {
  let streak = 0
  let cursor = startOfDay(today)
  // If today isn't logged yet, that shouldn't zero out yesterday's streak —
  // start counting from today only if it's done, otherwise from yesterday.
  if (!completedDateKeys.has(toDateKey(cursor))) {
    cursor = addDays(cursor, -1)
  }
  while (completedDateKeys.has(toDateKey(cursor))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function computeThisWeekCount(completedDateKeys: Set<string>, today: Date): number {
  const start = startOfDay(today)
  start.setDate(start.getDate() - start.getDay()) // Sunday
  let count = 0
  for (let i = 0; i < 7; i++) {
    if (completedDateKeys.has(toDateKey(addDays(start, i)))) count += 1
  }
  return count
}

export function computeConsistency(
  completedDateKeys: Set<string>,
  today: Date,
  windowDays: number
): number {
  let count = 0
  for (let i = 0; i < windowDays; i++) {
    if (completedDateKeys.has(toDateKey(addDays(startOfDay(today), -i)))) count += 1
  }
  return Math.round((count / windowDays) * 100)
}

export type WeekdayStat = {
  day: string
  dayIndex: number
  completed: number
  opportunities: number
  rate: number // 0-100
}

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

// Opportunities per weekday assumes every active habit existed for the
// whole window — a simplification (a habit added mid-window looks like it
// was "missed" on earlier days), acceptable for a lightweight insight but
// worth remembering if this ever needs to be exact.
export function computeWeekdayStats(
  completedLogDates: Date[],
  activeHabitCount: number,
  windowDays: number,
  today: Date
): WeekdayStat[] {
  const completedCounts = new Array(7).fill(0)
  for (const d of completedLogDates) completedCounts[d.getDay()] += 1

  const dayOccurrences = new Array(7).fill(0)
  for (let i = 0; i < windowDays; i++) {
    dayOccurrences[addDays(startOfDay(today), -i).getDay()] += 1
  }

  return WEEKDAY_LABELS.map((day, dayIndex) => {
    const opportunities = dayOccurrences[dayIndex] * activeHabitCount
    const completed = completedCounts[dayIndex]
    return {
      day,
      dayIndex,
      completed,
      opportunities,
      rate: opportunities > 0 ? Math.round((completed / opportunities) * 100) : 0,
    }
  })
}

export { toDateKey }
