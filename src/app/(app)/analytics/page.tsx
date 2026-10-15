"use client"

import { db } from "@/lib/db"
import { useAuth } from "@/local/auth-context"
import { useLocalData } from "@/local/use-local-data"
import {
  computeConsistency,
  computeCurrentStreak,
  computeWeekdayStats,
  toDateKey,
} from "@/lib/habit-stats"
import { habitWeekdayInsight, taskCompletionInsight, type Insight } from "@/lib/insights"
import { AnalyticsView } from "./analytics-view"
import type { HabitConsistencyRow, SpendingCategoryRow, TaskTrendDay } from "./analytics-types"

const TASK_TREND_DAYS = 14
const WEEKDAY_INSIGHT_WINDOW_DAYS = 56

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const { data, loading } = useLocalData(async () => {
    if (!user) return null

    const today = startOfDay(new Date())
    const trendStart = new Date(today)
    trendStart.setDate(trendStart.getDate() - (TASK_TREND_DAYS - 1))
    const trendEnd = new Date(today)
    trendEnd.setDate(trendEnd.getDate() + 1)

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1)

    const habitWindowStart = new Date(today)
    habitWindowStart.setDate(habitWindowStart.getDate() - WEEKDAY_INSIGHT_WINDOW_DAYS)

    const [dueTasks, habits, monthTransactions] = await Promise.all([
      db.task.findMany({
        where: {
          userId: user.id,
          dueDate: { gte: trendStart, lt: trendEnd },
          status: { not: "CANCELLED" },
        },
        select: { dueDate: true, status: true },
      }),
      db.habit.findMany({
        where: { userId: user.id, active: true },
        include: {
          logs: {
            where: { date: { gte: habitWindowStart }, completed: true },
            select: { date: true },
          },
        },
      }),
      db.transaction.findMany({
        where: { userId: user.id, type: "EXPENSE", date: { gte: monthStart, lt: monthEnd } },
        select: { category: true, amount: true },
      }),
    ])

    const trendMap = new Map<string, { completed: number; total: number }>()
    for (let i = 0; i < TASK_TREND_DAYS; i++) {
      const d = new Date(trendStart)
      d.setDate(d.getDate() + i)
      trendMap.set(toDateKey(d), { completed: 0, total: 0 })
    }
    for (const task of dueTasks) {
      if (!task.dueDate) continue
      const key = toDateKey(task.dueDate)
      const entry = trendMap.get(key)
      if (!entry) continue
      entry.total += 1
      if (task.status === "DONE") entry.completed += 1
    }
    const taskTrend: TaskTrendDay[] = Array.from(trendMap.entries()).map(([dateKey, v]) => ({
      dateKey,
      completed: v.completed,
      total: v.total,
      rate: v.total > 0 ? Math.round((v.completed / v.total) * 100) : null,
    }))
    const trendWithData = taskTrend.filter((d) => d.total > 0)
    const overallTaskCompletionRate =
      trendWithData.length > 0
        ? Math.round(
            (trendWithData.reduce((s, d) => s + d.completed, 0) /
              trendWithData.reduce((s, d) => s + d.total, 0)) *
              100
          )
        : null

    const habitRows: HabitConsistencyRow[] = habits.map((habit) => {
      const dateKeys = new Set<string>(habit.logs.map((l: { date: Date }) => toDateKey(l.date)))
      return {
        id: habit.id,
        name: habit.name,
        consistency30d: computeConsistency(dateKeys, today, 30),
        currentStreak: computeCurrentStreak(dateKeys, today),
      }
    })
    const overallHabitConsistency =
      habitRows.length > 0
        ? Math.round(habitRows.reduce((s, h) => s + h.consistency30d, 0) / habitRows.length)
        : null

    const spendingMap = new Map<string, number>()
    for (const t of monthTransactions) {
      spendingMap.set(t.category, (spendingMap.get(t.category) ?? 0) + t.amount)
    }
    const spendingByCategory: SpendingCategoryRow[] = Array.from(spendingMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)

    const allCompletedLogDates = habits.flatMap((h) =>
      h.logs.map((l: { date: Date }) => l.date)
    )
    const weekdayStats = computeWeekdayStats(
      allCompletedLogDates,
      habits.length,
      WEEKDAY_INSIGHT_WINDOW_DAYS,
      today
    )

    const insights: Insight[] = [
      taskCompletionInsight(
        trendWithData.reduce((s, d) => s + d.completed, 0),
        trendWithData.reduce((s, d) => s + d.total, 0),
        "last 14 days"
      ),
      habitWeekdayInsight(weekdayStats),
    ].filter((i): i is Insight => i !== null)

    return {
      taskTrend,
      overallTaskCompletionRate,
      habitRows,
      overallHabitConsistency,
      spendingByCategory,
      insights,
    }
  }, [user?.id])

  if (loading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  return (
    <AnalyticsView
      taskTrend={data.taskTrend}
      overallTaskCompletionRate={data.overallTaskCompletionRate}
      habitRows={data.habitRows}
      overallHabitConsistency={data.overallHabitConsistency}
      spendingByCategory={data.spendingByCategory}
      insights={data.insights}
    />
  )
}
