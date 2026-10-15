import type { WeekdayStat } from "./habit-stats"

// Every sentence here is generated only from numbers already computed
// elsewhere (task counts, habit weekday stats) — no invented claims, no
// tracking that doesn't exist. A function returns null rather than a
// sentence when the underlying data can't honestly support one (too little
// data, or no meaningful gap to point out).
export type Insight = { id: string; text: string }

export function taskCompletionInsight(
  completed: number,
  total: number,
  windowLabel: string
): Insight | null {
  if (total === 0) return null
  return {
    id: "task-completion",
    text: `You completed ${completed}/${total} tasks due in the ${windowLabel}.`,
  }
}

const MIN_OPPORTUNITIES = 3
const MIN_GAP_POINTS = 15

export function habitWeekdayInsight(stats: WeekdayStat[]): Insight | null {
  const eligible = stats.filter((s) => s.opportunities >= MIN_OPPORTUNITIES)
  if (eligible.length < 2) return null

  const avgRate = eligible.reduce((sum, s) => sum + s.rate, 0) / eligible.length
  const lowest = eligible.reduce((min, s) => (s.rate < min.rate ? s : min))

  if (avgRate - lowest.rate < MIN_GAP_POINTS) return null

  return {
    id: "habit-weekday",
    text: `Your ${lowest.day} habit consistency (${lowest.rate}%) is lower than your other days (avg ${Math.round(avgRate)}%).`,
  }
}
