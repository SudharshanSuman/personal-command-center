"use client"

import Link from "next/link"
import { CalendarDays, CheckCircle2, Circle, ListTodo, Repeat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QuickAddTask } from "@/components/quick-add-task"
import { db } from "@/lib/db"
import { useAuth } from "@/local/auth-context"
import { useLocalData } from "@/local/use-local-data"
import type { Priority } from "@/generated/prisma/enums"
import { computeDeadlineRisk, daysUntil, type DeadlineRisk } from "@/lib/deadline-risk"
import { PriorityTaskList } from "./priority-task-list"

const PRIORITY_RANK: Record<Priority, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { data, loading } = useLocalData(async () => {
    if (!user) return null

    const todayStart = startOfDay(new Date())
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)
    const sevenDaysOut = new Date(todayStart)
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7)

    const [todaysEvents, priorityTasks, dueTasks, dueAssessments, habits, todaysLogs] =
      await Promise.all([
        db.event.findMany({
          where: { userId: user.id, startsAt: { gte: todayStart, lt: todayEnd } },
          orderBy: { startsAt: "asc" },
        }),
        db.task.findMany({
          where: {
            userId: user.id,
            status: { in: ["TODO", "IN_PROGRESS"] },
            priority: { in: ["HIGH", "URGENT"] },
          },
        }),
        db.task.findMany({
          where: {
            userId: user.id,
            status: { in: ["TODO", "IN_PROGRESS"] },
            dueDate: { gte: todayStart, lte: sevenDaysOut },
          },
        }),
        db.assessment.findMany({
          where: { userId: user.id, date: { gte: todayStart, lte: sevenDaysOut } },
          include: { events: { where: { type: "STUDY_SESSION" }, select: { id: true } } },
        }),
        db.habit.findMany({ where: { userId: user.id, active: true } }),
        db.habitLog.findMany({
          where: {
            habit: { userId: user.id },
            date: { gte: todayStart, lt: todayEnd },
            completed: true,
          },
        }),
      ])

    const topPriorityTasks = [...priorityTasks]
      .sort((a, b) => {
        const rankDiff =
          PRIORITY_RANK[a.priority as Priority] - PRIORITY_RANK[b.priority as Priority]
        if (rankDiff !== 0) return rankDiff
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.getTime() - b.dueDate.getTime()
      })
      .slice(0, 5)

    const deadlines = [
      ...dueTasks
        .filter((t) => t.dueDate)
        .map((t) => ({
          id: `task-${t.id}`,
          title: t.title,
          date: t.dueDate as Date,
          href: "/tasks",
          risk: null as DeadlineRisk,
        })),
      ...dueAssessments.map((a) => ({
        id: `assessment-${a.id}`,
        title: `${a.subject} — ${a.title}`,
        date: a.date,
        href: "/assessments",
        risk: computeDeadlineRisk(daysUntil(a.date, todayStart), a.prepStatus, a.events.length),
      })),
    ]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 7)

    const completedHabitIds = new Set<string>(todaysLogs.map((l) => l.habitId))

    return { todaysEvents, topPriorityTasks, deadlines, habits, completedHabitIds }
  }, [user?.id])

  if (loading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  const { todaysEvents, topPriorityTasks, deadlines, habits, completedHabitIds } = data

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </h1>
        <p className="text-muted-foreground">
          Welcome back{user?.name ? `, ${user.name}` : ""}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Today&apos;s schedule</CardTitle>
          </CardHeader>
          <CardContent>
            {todaysEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing on the calendar today — a clear day, or add something from Calendar.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {todaysEvents.map((event) => (
                  <li key={event.id} className="flex items-center gap-3 text-sm">
                    <span className="w-16 shrink-0 text-muted-foreground">
                      {event.allDay ? "All day" : formatTime(event.startsAt)}
                    </span>
                    <span>{event.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Top priorities</CardTitle>
          </CardHeader>
          <CardContent>
            {topPriorityTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing urgent right now. Nice place to be.
              </p>
            ) : (
              <PriorityTaskList
                tasks={topPriorityTasks.map((t) => ({
                  id: t.id,
                  title: t.title,
                  priority: t.priority,
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Upcoming deadlines (7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {deadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing due in the next week.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {deadlines.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 text-sm">
                    <span className="w-14 shrink-0 text-muted-foreground">
                      {formatDate(item.date)}
                    </span>
                    <span>{item.title}</span>
                    {item.risk === "behind" && (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                        Behind schedule
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Habits today</CardTitle>
          </CardHeader>
          <CardContent>
            {habits.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No habits set up yet. Add one from Habits to start tracking.
              </p>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  {completedHabitIds.size}/{habits.length} done today
                </p>
                <ul className="flex flex-col gap-2">
                  {habits.map((habit) => {
                    const done = completedHabitIds.has(habit.id)
                    return (
                      <li key={habit.id} className="flex items-center gap-2 text-sm">
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className={done ? "text-muted-foreground line-through" : ""}>
                          {habit.name}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <QuickAddTask className="h-8 rounded-md px-3 text-xs" />
          <Button asChild variant="outline" size="sm">
            <Link href="/tasks">View tasks</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/calendar">View calendar</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/habits">View habits</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/reviews">Start daily review</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
