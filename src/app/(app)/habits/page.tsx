"use client"

import { db } from "@/lib/db"
import { useAuth } from "@/local/auth-context"
import { useLocalData } from "@/local/use-local-data"
import {
  computeCurrentStreak,
  computeThisWeekCount,
  computeConsistency,
  toDateKey,
} from "@/lib/habit-stats"
import { HabitList } from "./habit-list"
import type { HabitView } from "./habit-types"

const HISTORY_WINDOW_DAYS = 35

export default function HabitsPage() {
  const { user } = useAuth()
  const { data, loading } = useLocalData(async () => {
    if (!user) return null
    const today = new Date()
    const windowStart = new Date(today)
    windowStart.setDate(windowStart.getDate() - HISTORY_WINDOW_DAYS)

    const habits = await db.habit.findMany({
      where: { userId: user.id },
      include: {
        logs: {
          where: { date: { gte: windowStart }, completed: true },
          select: { date: true },
        },
      },
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    })

    const views: HabitView[] = habits.map((habit) => {
      const dateKeys = new Set<string>(habit.logs.map((l: { date: Date }) => toDateKey(l.date)))
      return {
        id: habit.id,
        name: habit.name,
        description: habit.description,
        targetDaysPerWeek: habit.targetDaysPerWeek,
        active: habit.active,
        currentStreak: computeCurrentStreak(dateKeys, today),
        thisWeekCount: computeThisWeekCount(dateKeys, today),
        consistency30d: computeConsistency(dateKeys, today, 30),
        recentLogDates: Array.from(dateKeys),
      }
    })
    return views
  }, [user?.id])

  if (loading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }
  return <HabitList initialHabits={data} />
}
