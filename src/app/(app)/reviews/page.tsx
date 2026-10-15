"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { db } from "@/lib/db"
import { useAuth } from "@/local/auth-context"
import { useLocalData } from "@/local/use-local-data"
import { computeConsistency, toDateKey } from "@/lib/habit-stats"
import { ReviewTabs } from "./review-tabs"
import { DailyReview } from "./daily-review"
import { PeriodReview } from "./period-review"
import type {
  DailyHabitItem,
  DailyTaskItem,
  ExistingReviewDraft,
  PeriodSnapshot,
  ReviewPeriodTab,
} from "./review-types"

function isPeriodTab(value: string | undefined): value is ReviewPeriodTab {
  return value === "daily" || value === "weekly" || value === "monthly"
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function toDateParam(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

async function loadDraft(userId: string, period: "DAILY" | "WEEKLY" | "MONTHLY", anchor: Date) {
  const existing = await db.dailyReview.findUnique({
    where: { userId_period_date: { userId, period, date: anchor } },
  })
  const draft: ExistingReviewDraft = {
    wentWell: existing?.wentWell ?? "",
    needsAttention: existing?.needsAttention ?? "",
  }
  return draft
}

function ReviewsPageInner() {
  const { user } = useAuth()
  const sp = useSearchParams()
  const periodParam = sp.get("period") ?? undefined
  const tab: ReviewPeriodTab = isPeriodTab(periodParam) ? periodParam : "daily"

  const { data, loading } = useLocalData(async () => {
    if (!user) return null
    const today = startOfDay(new Date())

    if (tab === "daily") {
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const [openTasks, activeHabits, todaysLogs, draft] = await Promise.all([
        db.task.findMany({
          where: {
            userId: user.id,
            dueDate: { gte: today, lt: tomorrow },
            status: { in: ["TODO", "IN_PROGRESS"] },
          },
          select: { id: true, title: true, priority: true },
          orderBy: { priority: "asc" },
        }),
        db.habit.findMany({
          where: { userId: user.id, active: true },
          select: { id: true, name: true },
        }),
        db.habitLog.findMany({
          where: { habit: { userId: user.id }, date: { gte: today, lt: tomorrow }, completed: true },
          select: { habitId: true },
        }),
        loadDraft(user.id, "DAILY", today),
      ])

      const loggedHabitIds = new Set(todaysLogs.map((l) => l.habitId))
      const tasks: DailyTaskItem[] = openTasks
      const unloggedHabits: DailyHabitItem[] = activeHabits.filter(
        (h) => !loggedHabitIds.has(h.id)
      )

      return { kind: "daily" as const, dateKey: toDateParam(today), tasks, unloggedHabits, draft }
    }

    const isWeekly = tab === "weekly"
    const period: "WEEKLY" | "MONTHLY" = isWeekly ? "WEEKLY" : "MONTHLY"
    const anchor = isWeekly ? startOfWeek(today) : startOfMonth(today)
    const rangeEnd = isWeekly
      ? (() => {
          const d = new Date(anchor)
          d.setDate(d.getDate() + 7)
          return d
        })()
      : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)
    const consistencyWindow = isWeekly ? 7 : 30

    const sevenDaysOut = new Date(today)
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7)

    const [
      tasksInRange,
      goals,
      habits,
      habitLogs,
      assessments,
      transactions,
      draft,
      upcomingTasks,
      upcomingAssessments,
    ] = await Promise.all([
      db.task.findMany({
        where: {
          userId: user.id,
          dueDate: { gte: anchor, lt: rangeEnd },
          status: { not: "CANCELLED" },
        },
        select: { id: true, status: true },
      }),
      db.goal.findMany({
        where: { userId: user.id, status: "ACTIVE" },
        include: { tasks: { select: { status: true } } },
      }),
      db.habit.findMany({ where: { userId: user.id, active: true } }),
      db.habitLog.findMany({
        where: {
          habit: { userId: user.id },
          date: { gte: new Date(anchor.getTime() - consistencyWindow * 86400000) },
          completed: true,
        },
        select: { habitId: true, date: true },
      }),
      db.assessment.findMany({
        where: { userId: user.id, date: { gte: anchor, lt: rangeEnd } },
        orderBy: { date: "asc" },
      }),
      db.transaction.findMany({
        where: { userId: user.id, date: { gte: anchor, lt: rangeEnd } },
      }),
      loadDraft(user.id, period, anchor),
      db.task.findMany({
        where: {
          userId: user.id,
          status: { in: ["TODO", "IN_PROGRESS"] },
          dueDate: { gte: today, lte: sevenDaysOut },
        },
        select: { id: true, title: true, dueDate: true },
      }),
      db.assessment.findMany({
        where: { userId: user.id, date: { gte: today, lte: sevenDaysOut } },
        select: { id: true, subject: true, title: true, date: true },
      }),
    ])

    const completed = tasksInRange.filter((t) => t.status === "DONE").length

    const goalRows = goals.map((g) => {
      const hasLinked = g.tasks.length > 0
      const done = g.tasks.filter((t: { status: string }) => t.status === "DONE").length
      const progress = hasLinked ? Math.round((done / g.tasks.length) * 100) : g.progress
      return { id: g.id, title: g.title, progress, status: g.status }
    })

    const logsByHabit = new Map<string, Set<string>>()
    for (const log of habitLogs) {
      const set = logsByHabit.get(log.habitId) ?? new Set<string>()
      set.add(toDateKey(log.date))
      logsByHabit.set(log.habitId, set)
    }
    const habitRows = habits.map((h) => ({
      id: h.id,
      name: h.name,
      consistency: computeConsistency(
        logsByHabit.get(h.id) ?? new Set(),
        today,
        consistencyWindow
      ),
    }))

    const assessmentRows = assessments.map((a) => ({
      id: a.id,
      subject: a.subject,
      title: a.title,
      date: toDateParam(a.date),
      prepStatus: a.prepStatus,
    }))

    const income = transactions
      .filter((t) => t.type === "INCOME")
      .reduce((s, t) => s + t.amount, 0)
    const expense = transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((s, t) => s + t.amount, 0)

    const upcomingDeadlines = [
      ...upcomingTasks
        .filter((t) => t.dueDate)
        .map((t) => ({
          id: `task-${t.id}`,
          title: t.title,
          date: toDateParam(t.dueDate as Date),
        })),
      ...upcomingAssessments.map((a) => ({
        id: `assessment-${a.id}`,
        title: `${a.subject} — ${a.title}`,
        date: toDateParam(a.date),
      })),
    ]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 7)

    const snapshot: PeriodSnapshot = {
      taskCompletion: { completed, total: tasksInRange.length },
      goals: goalRows,
      habits: habitRows,
      assessments: assessmentRows,
      money: { income, expense, net: income - expense },
      upcomingDeadlines,
    }

    return {
      kind: "period" as const,
      period,
      dateKey: toDateParam(anchor),
      label: isWeekly ? "This week" : "This month",
      snapshot,
      draft,
    }
  }, [user?.id, tab])

  if (loading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
        <p className="text-muted-foreground">Reflect and reset — daily, weekly, or monthly.</p>
      </div>
      <ReviewTabs active={tab} />
      {data.kind === "daily" ? (
        <DailyReview
          dateKey={data.dateKey}
          initialTasks={data.tasks}
          initialUnloggedHabits={data.unloggedHabits}
          initialDraft={data.draft}
        />
      ) : (
        <PeriodReview
          period={data.period}
          dateKey={data.dateKey}
          label={data.label}
          snapshot={data.snapshot}
          initialDraft={data.draft}
        />
      )}
    </div>
  )
}

export default function ReviewsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <ReviewsPageInner />
    </Suspense>
  )
}
