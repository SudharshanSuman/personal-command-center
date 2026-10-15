export type HabitView = {
  id: string
  name: string
  description: string | null
  targetDaysPerWeek: number
  active: boolean
  currentStreak: number
  thisWeekCount: number
  consistency30d: number // 0-100
  recentLogDates: string[] // "YYYY-MM-DD", last 35 days that are completed
}
