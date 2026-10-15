"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { db } from "@/lib/db"
import { useAuth } from "@/local/auth-context"
import { useLocalData } from "@/local/use-local-data"
import { parseRecurrenceRule, computeNextOccurrence } from "@/lib/recurrence"
import { FinanceShell } from "./finance-shell"
import type {
  BudgetView,
  CategoryBreakdown,
  MonthlySummary,
  TransactionView,
  UpcomingPayment,
} from "./finance-types"

const UPCOMING_WINDOW_DAYS = 30

function parseMonthParam(value: string | undefined): { year: number; month: number } {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number)
    return { year, month: month - 1 }
  }
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() }
}

function toMonthParam(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`
}

function FinancesPageInner() {
  const { user } = useAuth()
  const sp = useSearchParams()
  const monthParam = sp.get("month") ?? undefined

  const { data, loading } = useLocalData(async () => {
    if (!user) return null
    const { year, month } = parseMonthParam(monthParam)
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 1)

    const [monthTransactions, recurringTransactions, budgets] = await Promise.all([
      db.transaction.findMany({
        where: { userId: user.id, date: { gte: monthStart, lt: monthEnd } },
        orderBy: { date: "desc" },
      }),
      db.transaction.findMany({
        where: { userId: user.id, recurrenceRule: { not: null } },
        orderBy: { date: "desc" },
      }),
      db.budget.findMany({ where: { userId: user.id, period: "monthly" } }),
    ])

    const transactionViews: TransactionView[] = monthTransactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      category: t.category,
      note: t.note,
      date: t.date,
      recurrenceRule: t.recurrenceRule,
    }))

    const budgetViews: BudgetView[] = budgets.map((b) => ({
      id: b.id,
      category: b.category,
      amount: b.amount,
      period: b.period,
    }))

    const income = monthTransactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + t.amount, 0)
    const expense = monthTransactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + t.amount, 0)

    const expenseByCategoryMap = new Map<string, number>()
    for (const t of monthTransactions) {
      if (t.type !== "EXPENSE") continue
      expenseByCategoryMap.set(t.category, (expenseByCategoryMap.get(t.category) ?? 0) + t.amount)
    }
    const budgetByCategory = new Map(budgetViews.map((b) => [b.category, b.amount]))
    const expenseByCategory: CategoryBreakdown[] = Array.from(expenseByCategoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        budget: budgetByCategory.get(category) ?? null,
      }))
      .sort((a, b) => b.amount - a.amount)

    const summary: MonthlySummary = { income, expense, net: income - expense, expenseByCategory }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const horizon = new Date(today)
    horizon.setDate(horizon.getDate() + UPCOMING_WINDOW_DAYS)

    const upcomingPayments: UpcomingPayment[] = []
    for (const t of recurringTransactions) {
      const rule = parseRecurrenceRule(t.recurrenceRule)
      if (!rule) continue
      let next = new Date(t.date)
      let guard = 0
      while (next < today && guard < 500) {
        next = computeNextOccurrence(next, rule)
        guard += 1
      }
      if (next >= today && next <= horizon) {
        const pad = (n: number) => String(n).padStart(2, "0")
        upcomingPayments.push({
          transactionId: t.id,
          category: t.category,
          amount: t.amount,
          note: t.note,
          nextDate: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`,
          rule,
        })
      }
    }
    upcomingPayments.sort((a, b) => a.nextDate.localeCompare(b.nextDate))

    return {
      month: toMonthParam(year, month),
      transactionViews,
      budgetViews,
      summary,
      upcomingPayments,
    }
  }, [user?.id, monthParam])

  if (loading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  return (
    <FinanceShell
      month={data.month}
      transactions={data.transactionViews}
      budgets={data.budgetViews}
      summary={data.summary}
      upcomingPayments={data.upcomingPayments}
    />
  )
}

export default function FinancesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <FinancesPageInner />
    </Suspense>
  )
}
