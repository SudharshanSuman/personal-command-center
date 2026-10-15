export type ReviewPeriodTab = "daily" | "weekly" | "monthly"

export type DailyTaskItem = {
  id: string
  title: string
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
}

export type DailyHabitItem = {
  id: string
  name: string
}

export type ExistingReviewDraft = {
  wentWell: string
  needsAttention: string
}

export type PeriodGoalRow = {
  id: string
  title: string
  progress: number
  status: string
}

export type PeriodHabitRow = {
  id: string
  name: string
  consistency: number
}

export type PeriodAssessmentRow = {
  id: string
  subject: string
  title: string
  date: string
  prepStatus: string
}

export type PeriodMoneySnapshot = {
  income: number
  expense: number
  net: number
}

export type PeriodDeadlineRow = {
  id: string
  title: string
  date: string
}

export type PeriodSnapshot = {
  taskCompletion: { completed: number; total: number }
  goals: PeriodGoalRow[]
  habits: PeriodHabitRow[]
  assessments: PeriodAssessmentRow[]
  money: PeriodMoneySnapshot
  upcomingDeadlines: PeriodDeadlineRow[]
}
