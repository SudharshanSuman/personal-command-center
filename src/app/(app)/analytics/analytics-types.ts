export type TaskTrendDay = {
  dateKey: string // "YYYY-MM-DD"
  completed: number
  total: number
  rate: number | null // 0-100, null when there were no tasks due that day
}

export type HabitConsistencyRow = {
  id: string
  name: string
  consistency30d: number
  currentStreak: number
}

export type SpendingCategoryRow = {
  category: string
  amount: number
}
