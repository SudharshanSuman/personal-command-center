"use client"

import { db } from "@/lib/db"
import { useAuth } from "@/local/auth-context"
import { useLocalData } from "@/local/use-local-data"
import { GoalList } from "./goal-list"
import type { GoalView, UnlinkedTaskOption } from "./goal-types"

export default function GoalsPage() {
  const { user } = useAuth()
  const { data, loading } = useLocalData(async () => {
    if (!user) return null
    const [goals, allActiveTasks] = await Promise.all([
      db.goal.findMany({
        where: { userId: user.id },
        include: { tasks: { select: { id: true, title: true, status: true } } },
        orderBy: [{ status: "asc" }, { targetDate: "asc" }],
      }),
      db.task.findMany({
        where: { userId: user.id, status: { in: ["TODO", "IN_PROGRESS"] } },
        select: { id: true, title: true, goalId: true },
        orderBy: { createdAt: "desc" },
      }),
    ])

    const goalViews: GoalView[] = goals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      timeframe: g.timeframe,
      status: g.status,
      targetDate: g.targetDate,
      progress: g.progress,
      tasks: g.tasks,
    }))

    const unlinkedTaskOptions: UnlinkedTaskOption[] = allActiveTasks
      .filter((t) => !t.goalId)
      .map((t) => ({ id: t.id, title: t.title }))

    return { goalViews, unlinkedTaskOptions }
  }, [user?.id])

  if (loading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }
  return <GoalList initialGoals={data.goalViews} unlinkedTaskOptions={data.unlinkedTaskOptions} />
}
