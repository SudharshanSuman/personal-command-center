// Reminder *data model* + fire-time computation only. There is no delivery
// mechanism (no browser push, no email, no background worker) — this
// environment can't run a persistent notification service, and VISION.md's
// own non-negotiable ("no notification spam") means a fake/best-effort
// delivery path would be worse than an honest gap. What exists: rules are
// created and stored, and a "nominal fire time" is computed and shown in an
// upcoming-reminders panel so the data is visibly correct and ready for a
// real delivery worker to consume later.

export const OFFSET_PRESETS = [
  { label: "At the time", minutes: 0 },
  { label: "15 minutes before", minutes: 15 },
  { label: "30 minutes before", minutes: 30 },
  { label: "1 hour before", minutes: 60 },
  { label: "1 day before", minutes: 60 * 24 },
  { label: "3 days before", minutes: 60 * 24 * 3 },
] as const

export function computeNominalFireTime(targetAt: Date, offsetMinutes: number): Date {
  return new Date(targetAt.getTime() - offsetMinutes * 60 * 1000)
}

function parseHHMM(value: string): { hours: number; minutes: number } {
  const [hours, minutes] = value.split(":").map(Number)
  return { hours: hours || 0, minutes: minutes || 0 }
}

// Quiet hours can wrap midnight (e.g. 22:00 -> 07:00). Returns whether the
// given time-of-day falls inside that window.
export function isWithinQuietHours(
  at: Date,
  quietHoursStart: string | null,
  quietHoursEnd: string | null
): boolean {
  if (!quietHoursStart || !quietHoursEnd) return false
  const start = parseHHMM(quietHoursStart)
  const end = parseHHMM(quietHoursEnd)
  const atMinutes = at.getHours() * 60 + at.getMinutes()
  const startMinutes = start.hours * 60 + start.minutes
  const endMinutes = end.hours * 60 + end.minutes

  if (startMinutes === endMinutes) return false
  if (startMinutes < endMinutes) {
    return atMinutes >= startMinutes && atMinutes < endMinutes
  }
  // wraps midnight
  return atMinutes >= startMinutes || atMinutes < endMinutes
}

// What a real delivery worker would do: hold a reminder that would fire
// during quiet hours until the window ends. Used here only to show the
// user an honest "would fire at" time in the upcoming-reminders panel.
export function computeEffectiveFireTime(
  nominalTime: Date,
  quietHoursStart: string | null,
  quietHoursEnd: string | null
): { effectiveTime: Date; heldForQuietHours: boolean } {
  if (!isWithinQuietHours(nominalTime, quietHoursStart, quietHoursEnd) || !quietHoursEnd) {
    return { effectiveTime: nominalTime, heldForQuietHours: false }
  }
  const { hours, minutes } = parseHHMM(quietHoursEnd)
  const effective = new Date(nominalTime)
  effective.setHours(hours, minutes, 0, 0)
  if (effective < nominalTime) effective.setDate(effective.getDate() + 1)
  return { effectiveTime: effective, heldForQuietHours: true }
}
