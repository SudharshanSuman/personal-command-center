"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Flame, Plus, Pencil } from "lucide-react"
import { HabitFormDialog } from "./habit-form-dialog"
import { toggleHabitLogAction } from "./actions"
import { toDateKey } from "@/lib/habit-stats"
import type { HabitView } from "./habit-types"

const GRID_DAYS = 35

function buildGridDates(today: Date): string[] {
  const dates: string[] = []
  for (let i = GRID_DAYS - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    dates.push(toDateKey(d))
  }
  return dates
}

function HabitHeatmap({ habitId, dates, completed }: { habitId: string; dates: string[]; completed: Set<string> }) {
  const [isPending, startTransition] = useTransition()

  function handleToggle(date: string) {
    startTransition(async () => {
      await toggleHabitLogAction({ habitId, date })
    })
  }

  return (
    <div className="grid grid-cols-7 gap-1" aria-disabled={isPending}>
      {dates.map((date) => {
        const isDone = completed.has(date)
        return (
          <button
            key={date}
            type="button"
            title={date}
            onClick={() => handleToggle(date)}
            disabled={isPending}
            className={`h-4 w-4 rounded-sm transition-colors ${
              isDone ? "bg-primary" : "bg-muted hover:bg-muted-foreground/30"
            }`}
          />
        )
      })}
    </div>
  )
}

function HabitCard({ habit }: { habit: HabitView }) {
  const today = new Date()
  const dates = buildGridDates(today)
  const completed = new Set(habit.recentLogDates)

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{habit.name}</h3>
            {!habit.active && <Badge variant="outline">Inactive</Badge>}
          </div>
          {habit.description && (
            <p className="mt-1 text-sm text-muted-foreground">{habit.description}</p>
          )}
        </div>
        <HabitFormDialog
          mode="edit"
          habit={habit}
          trigger={
            <Button variant="ghost" size="icon" aria-label="Edit habit">
              <Pencil className="h-4 w-4" />
            </Button>
          }
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-1 font-medium">
          <Flame className="h-4 w-4 text-orange-500" />
          {habit.currentStreak} day{habit.currentStreak === 1 ? "" : "s"}
        </span>
        <span className="text-muted-foreground">
          {habit.thisWeekCount}/{habit.targetDaysPerWeek} this week
        </span>
        <span className="text-muted-foreground">{habit.consistency30d}% last 30d</span>
      </div>

      <div className="mt-4">
        <HabitHeatmap habitId={habit.id} dates={dates} completed={completed} />
      </div>
    </div>
  )
}

export function HabitList({ initialHabits }: { initialHabits: HabitView[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Habits</h1>
          <p className="text-sm text-muted-foreground">
            {initialHabits.length} habit{initialHabits.length === 1 ? "" : "s"}
          </p>
        </div>
        <HabitFormDialog
          mode="create"
          trigger={
            <Button>
              <Plus className="mr-1 h-4 w-4" />
              New habit
            </Button>
          }
        />
      </div>

      {initialHabits.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          No habits yet. Add one to start tracking.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {initialHabits.map((habit) => (
            <HabitCard key={habit.id} habit={habit} />
          ))}
        </div>
      )}
    </div>
  )
}
