"use client"

import { useMemo, useState, useTransition } from "react"
import { CheckCircle2, Circle, ChevronDown, ChevronRight, Pencil, Plus, Trash2, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { setTaskStatusAction } from "@/app/(app)/tasks/actions"
import { deleteGoalAction, setTaskGoalAction, createTaskForGoalAction } from "./actions"
import { GoalFormDialog } from "./goal-form-dialog"
import type { GoalView, UnlinkedTaskOption } from "./goal-types"

const TIMEFRAME_LABEL: Record<GoalView["timeframe"], string> = {
  SHORT_TERM: "Short-term",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
}

const STATUS_LABEL: Record<GoalView["status"], string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ABANDONED: "Abandoned",
}

function daysUntil(date: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function formatTargetDate(date: Date): string {
  const days = daysUntil(date)
  const formatted = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  if (days < 0) return `${formatted} (passed)`
  if (days === 0) return `${formatted} (today)`
  return `${formatted} (${days} day${days === 1 ? "" : "s"} left)`
}

export function GoalList({
  initialGoals,
  unlinkedTaskOptions,
}: {
  initialGoals: GoalView[]
  unlinkedTaskOptions: UnlinkedTaskOption[]
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const sortedGoals = useMemo(() => {
    return [...initialGoals].sort((a, b) => {
      if (a.status !== b.status) return a.status === "ACTIVE" ? -1 : 1
      if (!a.targetDate) return 1
      if (!b.targetDate) return -1
      return a.targetDate.getTime() - b.targetDate.getTime()
    })
  }, [initialGoals])

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleDelete(goal: GoalView) {
    if (!window.confirm(`Delete goal "${goal.title}"? Linked tasks will be unlinked, not deleted.`)) return
    startTransition(() => {
      deleteGoalAction(goal.id)
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
          <p className="text-muted-foreground">
            {initialGoals.length} goal{initialGoals.length === 1 ? "" : "s"}
          </p>
        </div>
        <GoalFormDialog
          mode="create"
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New goal
            </Button>
          }
        />
      </div>

      {sortedGoals.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No goals yet — set your first short-term or long-term goal to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedGoals.map((goal) => {
            const isExpanded = expanded.has(goal.id)
            const doneCount = goal.tasks.filter((t) => t.status === "DONE").length
            const hasLinkedTasks = goal.tasks.length > 0
            const computedPercent = hasLinkedTasks
              ? Math.round((doneCount / goal.tasks.length) * 100)
              : goal.progress

            return (
              <Card key={goal.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(goal.id)}
                        className="text-muted-foreground"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{goal.title}</span>
                      <Badge variant="secondary">{TIMEFRAME_LABEL[goal.timeframe]}</Badge>
                      {goal.status !== "ACTIVE" && (
                        <Badge variant="outline">{STATUS_LABEL[goal.status]}</Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 pl-6 text-xs text-muted-foreground">
                      {goal.targetDate && <span>{formatTargetDate(goal.targetDate)}</span>}
                      <span>
                        {hasLinkedTasks
                          ? `${doneCount}/${goal.tasks.length} linked tasks done (${computedPercent}%)`
                          : `${computedPercent}% progress`}
                      </span>
                    </div>
                    {goal.description && (
                      <p className="mt-1 pl-6 text-sm text-muted-foreground">{goal.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <GoalFormDialog
                      mode="edit"
                      goal={goal}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Edit goal">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete goal"
                      onClick={() => handleDelete(goal)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="flex flex-col gap-3 pl-12">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${computedPercent}%` }}
                      />
                    </div>

                    {goal.tasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No tasks linked yet.</p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {goal.tasks.map((task) => (
                          <li key={task.id} className="flex items-center gap-2 text-sm">
                            <button
                              type="button"
                              aria-label="Toggle complete"
                              onClick={() =>
                                startTransition(() =>
                                  setTaskStatusAction(
                                    task.id,
                                    task.status === "DONE" ? "TODO" : "DONE"
                                  )
                                )
                              }
                            >
                              {task.status === "DONE" ? (
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            <span
                              className={cn(
                                "flex-1",
                                task.status === "DONE" && "text-muted-foreground line-through"
                              )}
                            >
                              {task.title}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() =>
                                startTransition(() => setTaskGoalAction(task.id, null))
                              }
                            >
                              Unlink
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <LinkTaskRow goalId={goal.id} unlinkedTaskOptions={unlinkedTaskOptions} />
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LinkTaskRow({
  goalId,
  unlinkedTaskOptions,
}: {
  goalId: string
  unlinkedTaskOptions: UnlinkedTaskOption[]
}) {
  const [, startTransition] = useTransition()
  const [selectedTaskId, setSelectedTaskId] = useState<string>("")
  const [newTaskTitle, setNewTaskTitle] = useState("")

  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
      {unlinkedTaskOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Link an existing task" />
            </SelectTrigger>
            <SelectContent>
              {unlinkedTaskOptions.map((task) => (
                <SelectItem key={task.id} value={task.id}>
                  {task.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!selectedTaskId}
            onClick={() => {
              if (!selectedTaskId) return
              startTransition(() => setTaskGoalAction(selectedTaskId, goalId))
              setSelectedTaskId("")
            }}
          >
            Link
          </Button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="New task for this goal"
          className="w-56"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!newTaskTitle.trim()}
          onClick={() => {
            const title = newTaskTitle.trim()
            if (!title) return
            startTransition(() => createTaskForGoalAction({ goalId, title }))
            setNewTaskTitle("")
          }}
        >
          Add
        </Button>
      </div>
    </div>
  )
}
