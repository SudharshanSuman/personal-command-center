// Deliberately simple, explainable heuristic — not a predictive model. Purely
// derived from data already in the schema (days until the exam, prepStatus,
// and confirmed study-session count), no new tracking added. Returns null
// when there isn't enough of a signal to call it either way (already
// happened, or too far out to meaningfully judge) rather than guessing.
export type DeadlineRisk = "behind" | "on-track" | null

const ACTIONABLE_WINDOW_DAYS = 14

export function computeDeadlineRisk(
  daysRemaining: number,
  prepStatus: "NOT_STARTED" | "IN_PROGRESS" | "REVIEW" | "READY",
  studySessionCount: number
): DeadlineRisk {
  if (daysRemaining < 0) return null // already happened

  if (prepStatus === "READY") return "on-track"

  if (daysRemaining <= 2) {
    // exam is imminent — only REVIEW/READY-level prep counts as on track
    return prepStatus === "REVIEW" ? "on-track" : "behind"
  }

  if (daysRemaining <= 7) {
    // a week out — expect prep underway and at least one session booked
    return prepStatus === "NOT_STARTED" || studySessionCount === 0 ? "behind" : "on-track"
  }

  if (daysRemaining <= ACTIONABLE_WINDOW_DAYS) {
    // still early, but flag total inaction
    return prepStatus === "NOT_STARTED" && studySessionCount === 0 ? "behind" : "on-track"
  }

  // beyond the actionable window — too early to fairly call it either way
  return null
}

export function daysUntil(date: Date, today: Date): number {
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - start.getTime()) / 86400000)
}
