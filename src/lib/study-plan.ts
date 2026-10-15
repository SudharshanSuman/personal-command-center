// Deliberately simple, explainable heuristic — not a scheduling solver.
// VISION.md is explicit that intelligent features must earn their place, so
// this does the minimum useful thing: spread the requested prep time evenly
// across evenings (weekdays) and daytime (weekends) between now and the
// exam, skipping any slot that overlaps something already on the calendar.

export type Routine = {
  wake: string // "HH:mm"
  sleep: string
  workStart: string
  workEnd: string
}

export type BusyInterval = { start: Date; end: Date }

export type SuggestedBlock = { startsAt: Date; endsAt: Date }

const DEFAULT_ROUTINE: Routine = {
  wake: "07:00",
  sleep: "23:00",
  workStart: "09:00",
  workEnd: "17:00",
}

function parseTimeOnDay(day: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(":").map(Number)
  const d = new Date(day)
  d.setHours(hours || 0, minutes || 0, 0, 0)
  return d
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

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function studyWindowForDay(day: Date, routine: Routine): { start: Date; end: Date } {
  if (isWeekend(day)) {
    // Late-morning start on weekends rather than first-thing — leaves the
    // early morning free, matches IA's "evenings and weekends" framing.
    const weekendStart = parseTimeOnDay(day, "10:00")
    return { start: weekendStart, end: parseTimeOnDay(day, routine.sleep) }
  }
  return { start: parseTimeOnDay(day, routine.workEnd), end: parseTimeOnDay(day, routine.sleep) }
}

// Finds the first gap of at least `durationMinutes` within [windowStart,
// windowEnd) that doesn't overlap any interval in `busy`. Returns null if
// no such gap exists.
function findFreeSlot(
  windowStart: Date,
  windowEnd: Date,
  busy: BusyInterval[],
  durationMinutes: number
): SuggestedBlock | null {
  const durationMs = durationMinutes * 60 * 1000
  const relevant = busy
    .filter((b) => b.end > windowStart && b.start < windowEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  let cursor = windowStart
  for (const interval of relevant) {
    if (interval.start.getTime() - cursor.getTime() >= durationMs) {
      return { startsAt: cursor, endsAt: new Date(cursor.getTime() + durationMs) }
    }
    if (interval.end > cursor) cursor = interval.end
  }
  if (windowEnd.getTime() - cursor.getTime() >= durationMs) {
    return { startsAt: cursor, endsAt: new Date(cursor.getTime() + durationMs) }
  }
  return null
}

export function suggestStudyBlocks(params: {
  now: Date
  examDate: Date
  totalMinutes: number
  sessionMinutes: number
  routine?: Partial<Routine>
  existingEvents: BusyInterval[]
  maxSessionsPerDay?: number
}): SuggestedBlock[] {
  const routine: Routine = { ...DEFAULT_ROUTINE, ...params.routine }
  const maxPerDay = params.maxSessionsPerDay ?? 2
  const sessionsNeeded = Math.max(1, Math.ceil(params.totalMinutes / params.sessionMinutes))

  const firstCandidateDay = addDays(startOfDay(params.now), 1) // start tomorrow
  const lastCandidateDay = addDays(startOfDay(params.examDate), -1) // day before the exam

  const days: Date[] = []
  for (let d = firstCandidateDay; d <= lastCandidateDay; d = addDays(d, 1)) {
    days.push(d)
  }

  if (days.length === 0) return []

  const placed: SuggestedBlock[] = []
  const perDayCount = new Map<string, number>()
  const dayKey = (d: Date) => d.toDateString()

  // Up to `maxPerDay` passes: pass 1 tries to place one session per day
  // across the whole range first (spreads load evenly before doubling up
  // on any single day), later passes fill in remaining days if the range
  // is too short to fit everything at one-per-day.
  for (let pass = 0; pass < maxPerDay && placed.length < sessionsNeeded; pass++) {
    for (const day of days) {
      if (placed.length >= sessionsNeeded) break
      if ((perDayCount.get(dayKey(day)) ?? 0) > pass) continue

      const { start, end } = studyWindowForDay(day, routine)
      const occupied: BusyInterval[] = [
        ...params.existingEvents,
        ...placed.map((p) => ({ start: p.startsAt, end: p.endsAt })),
      ]

      const slot = findFreeSlot(start, end, occupied, params.sessionMinutes)
      if (slot) {
        placed.push(slot)
        perDayCount.set(dayKey(day), (perDayCount.get(dayKey(day)) ?? 0) + 1)
      }
    }
  }

  return placed.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}
