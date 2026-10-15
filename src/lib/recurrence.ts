import { z } from "zod"

// Deliberately simple — not a full RRULE engine. VISION.md's Must-Have scope
// only calls for daily/weekly/monthly/custom-interval recurrence, so that's
// all this supports. "custom" reuses the same day-interval math as the
// others, just with a user-supplied interval instead of a fixed one.
export const RecurrenceRuleSchema = z.object({
  freq: z.enum(["daily", "weekly", "monthly", "custom"]),
  interval: z.number().int().min(1).max(365),
})

export type RecurrenceRule = z.infer<typeof RecurrenceRuleSchema>

export function parseRecurrenceRule(value: string | null | undefined): RecurrenceRule | null {
  if (!value) return null
  try {
    const parsed = RecurrenceRuleSchema.safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function stringifyRecurrenceRule(rule: RecurrenceRule | null): string | null {
  return rule ? JSON.stringify(rule) : null
}

export function describeRecurrenceRule(rule: RecurrenceRule): string {
  const n = rule.interval
  switch (rule.freq) {
    case "daily":
      return n === 1 ? "Daily" : `Every ${n} days`
    case "weekly":
      return n === 1 ? "Weekly" : `Every ${n} weeks`
    case "monthly":
      return n === 1 ? "Monthly" : `Every ${n} months`
    case "custom":
      return `Every ${n} day${n === 1 ? "" : "s"}`
  }
}

export function computeNextOccurrence(from: Date, rule: RecurrenceRule): Date {
  const next = new Date(from)
  switch (rule.freq) {
    case "daily":
    case "custom":
      next.setDate(next.getDate() + rule.interval)
      break
    case "weekly":
      next.setDate(next.getDate() + rule.interval * 7)
      break
    case "monthly":
      next.setMonth(next.getMonth() + rule.interval)
      break
  }
  return next
}

// Used only for calendar events, which need concrete rows to show up on the
// grid (no on-the-fly RRULE expansion). Bounded so a "daily" rule doesn't
// generate an unbounded number of rows — extending the window is a
// deliberate fast-follow, not built now.
const MAX_MATERIALIZED_OCCURRENCES = 12
const MAX_MATERIALIZED_HORIZON_DAYS = 180

export function materializeOccurrences(start: Date, rule: RecurrenceRule): Date[] {
  const occurrences: Date[] = [start]
  const horizon = new Date(start)
  horizon.setDate(horizon.getDate() + MAX_MATERIALIZED_HORIZON_DAYS)

  let current = start
  while (occurrences.length < MAX_MATERIALIZED_OCCURRENCES) {
    current = computeNextOccurrence(current, rule)
    if (current > horizon) break
    occurrences.push(current)
  }
  return occurrences
}
