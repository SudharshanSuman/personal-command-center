"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, ArrowRight, Trash2, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  reviewMarkTaskDoneAction,
  reviewCarryTaskAction,
  reviewDeleteTaskAction,
  reviewLogHabitAction,
  submitDailyReviewAction,
} from "./actions"
import type { DailyHabitItem, DailyTaskItem, ExistingReviewDraft } from "./review-types"

const PRIORITY_LABEL: Record<DailyTaskItem["priority"], string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
}

export function DailyReview({
  dateKey,
  initialTasks,
  initialUnloggedHabits,
  initialDraft,
}: {
  dateKey: string
  initialTasks: DailyTaskItem[]
  initialUnloggedHabits: DailyHabitItem[]
  initialDraft: ExistingReviewDraft
}) {
  const [isPending, startTransition] = useTransition()
  const [tasks, setTasks] = useState(initialTasks)
  const [unloggedHabits, setUnloggedHabits] = useState(initialUnloggedHabits)
  const [wentWell, setWentWell] = useState(initialDraft.wentWell)
  const [needsAttention, setNeedsAttention] = useState(initialDraft.needsAttention)
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [carriedIds, setCarriedIds] = useState<string[]>([])
  const [loggedHabitIds, setLoggedHabitIds] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleComplete(taskId: string) {
    setTasks((t) => t.filter((task) => task.id !== taskId))
    setCompletedIds((ids) => [...ids, taskId])
    startTransition(async () => {
      await reviewMarkTaskDoneAction(taskId)
    })
  }

  function handleCarry(taskId: string) {
    setTasks((t) => t.filter((task) => task.id !== taskId))
    setCarriedIds((ids) => [...ids, taskId])
    startTransition(async () => {
      await reviewCarryTaskAction(taskId)
    })
  }

  function handleDelete(taskId: string) {
    setTasks((t) => t.filter((task) => task.id !== taskId))
    startTransition(async () => {
      await reviewDeleteTaskAction(taskId)
    })
  }

  function handleLogHabit(habitId: string) {
    setUnloggedHabits((h) => h.filter((habit) => habit.id !== habitId))
    setLoggedHabitIds((ids) => [...ids, habitId])
    startTransition(async () => {
      await reviewLogHabitAction(habitId, dateKey)
    })
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      try {
        await submitDailyReviewAction({
          date: dateKey,
          completedTaskIds: completedIds,
          carriedTaskIds: carriedIds,
          loggedHabitIds,
          wentWell,
          needsAttention,
        })
        setSubmitted(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    })
  }

  if (submitted) {
    return (
      <div className="max-w-2xl rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2 text-lg font-medium">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          Review complete
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>{completedIds.length} task(s) completed</p>
          <p>{carriedIds.length} task(s) carried to tomorrow</p>
          <p>{loggedHabitIds.length} habit(s) logged</p>
          {tasks.length > 0 && <p>{tasks.length} task(s) left open, marked missed</p>}
        </div>
        {(wentWell || needsAttention) && (
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 text-sm">
            {wentWell && (
              <div>
                <p className="font-medium">What went well</p>
                <p className="text-muted-foreground">{wentWell}</p>
              </div>
            )}
            {needsAttention && (
              <div>
                <p className="font-medium">What needs attention</p>
                <p className="text-muted-foreground">{needsAttention}</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-medium">Today&apos;s open tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing left open — nice.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <span>{task.title}</span>
                  <Badge variant="outline">{PRIORITY_LABEL[task.priority]}</Badge>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Mark complete"
                    disabled={isPending}
                    onClick={() => handleComplete(task.id)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Carry to tomorrow"
                    disabled={isPending}
                    onClick={() => handleCarry(task.id)}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete"
                    disabled={isPending}
                    onClick={() => handleDelete(task.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-medium">Unlogged habits</h2>
        {unloggedHabits.length === 0 ? (
          <p className="text-sm text-muted-foreground">All active habits logged today.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {unloggedHabits.map((habit) => (
              <button
                key={habit.id}
                type="button"
                disabled={isPending}
                onClick={() => handleLogHabit(habit.id)}
                className="flex items-center gap-2 py-2 text-left text-sm hover:text-primary"
              >
                <Circle className="h-4 w-4 text-muted-foreground" />
                {habit.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-medium">Reflection</h2>
        {error && (
          <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="went-well">What went well?</Label>
            <Textarea
              id="went-well"
              value={wentWell}
              onChange={(e) => setWentWell(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="needs-attention">What needs attention?</Label>
            <Textarea
              id="needs-attention"
              value={needsAttention}
              onChange={(e) => setNeedsAttention(e.target.value)}
              rows={3}
            />
          </div>
          <Button onClick={handleSubmit} disabled={isPending} className="w-fit">
            {isPending ? "Saving..." : "Complete review"}
          </Button>
        </div>
      </div>
    </div>
  )
}
