import type { RecurrenceRule } from "@/lib/recurrence"

export type TransactionView = {
  id: string
  type: "INCOME" | "EXPENSE"
  amount: number
  category: string
  note: string | null
  date: Date
  recurrenceRule: string | null
}

export type BudgetView = {
  id: string
  category: string
  amount: number
  period: string
}

export type CategoryBreakdown = {
  category: string
  amount: number
  budget: number | null
}

export type MonthlySummary = {
  income: number
  expense: number
  net: number
  expenseByCategory: CategoryBreakdown[]
}

export type UpcomingPayment = {
  transactionId: string
  category: string
  amount: number
  note: string | null
  nextDate: string // "YYYY-MM-DD"
  rule: RecurrenceRule
}
