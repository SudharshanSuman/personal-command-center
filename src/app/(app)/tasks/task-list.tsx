"use client"

import { useMemo, useState, useTransition } from "react"
import { CheckCircle2, Circle, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { describeRecurrenceRule } from "@/lib/recurrence"
import { deleteTaskAction, setTaskStatusAction } from "./actions"
import { TaskFormDialog } from "./task-form-dialog"
import type { TaskView } from "./task-types"

type StatusFilter = "ALL" | "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED"
type PriorityFilter = "ALL" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"
type SortKey = "dueDate" | "priority" | "status"

const PRIORITY_RANK: Record<TaskView["priority"], number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

const STATUS_RANK: Record<TaskView["status"], number> = {
  TODO: 0,
  IN_PROGRESS: 1,
  DONE: 2,
  CANCELLED: 3,
}

const PRIORITY_LABEL: Record<TaskView["priority"], string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
}

function isOverdue(task: TaskView): boolean {
  if (!task.dueDate) return false
  if (task.status === "DONE" || task.status === "CANCELLED") return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return task.dueDate < today
}

function formatDueDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function sortTasks(tasks: TaskView[], sortKey: SortKey): TaskView[] {
  return [...tasks].sort((a, b) => {
    if (sortKey === "priority") return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    if (sortKey === "status") return STATUS_RANK[a.status] - STATUS_RANK[b.status]
    // dueDate: tasks without a due date sort last
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate.getTime() - b.dueDate.getTime()
  })
}

export function TaskList({ initialTasks }: { initialTasks: TaskView[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL")
  const [sortKey, setSortKey] = useState<SortKey>("dueDate")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const byFilter = initialTasks.filter((task) => {
      if (statusFilter !== "ALL" && task.status !== statusFilter) return false
      if (priorityFilter !== "ALL" && task.priority !== priorityFilter) return false
      return true
    })
    return sortTasks(byFilter, sortKey)
  }, [initialTasks, statusFilter, priorityFilter, sortKey])

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleToggleComplete(task: TaskView) {
    startTransition(() => {
      setTaskStatusAction(task.id, task.status === "DONE" ? "TODO" : "DONE")
    })
  }

  function handleDelete(task: TaskView) {
    const subtaskWarning =
      task.subtasks.length > 0
        ? ` This will also delete its ${task.subtasks.length} subtask${task.subtasks.length === 1 ? "" : "s"}.`
        : ""
    if (!window.confirm(`Delete "${task.title}"?${subtaskWarning}`)) return
    startTransition(() => {
      deleteTaskAction(task.id)
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            {initialTasks.length} task{initialTasks.length === 1 ? "" : "s"}
          </p>
        </div>
        <TaskFormDialog
          mode="create"
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New task
            </Button>
          }
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="TODO">To do</SelectItem>
            <SelectItem value="IN_PROGRESS">In progress</SelectItem>
            <SelectItem value="DONE">Done</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={priorityFilter}
          onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All priorities</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dueDate">Sort by due date</SelectItem>
            <SelectItem value="priority">Sort by priority</SelectItem>
            <SelectItem value="status">Sort by status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {initialTasks.length === 0
            ? "No tasks yet — create your first one to get started."
            : "No tasks match these filters."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((task) => {
            const overdue = isOverdue(task)
            const doneSubtasks = task.subtasks.filter((s) => s.status === "DONE").length
            const isExpanded = expanded.has(task.id)

            return (
              <li key={task.id} className="rounded-md border">
                <div className="flex items-center gap-3 p-3">
                  {task.subtasks.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(task.id)}
                      className="shrink-0 text-muted-foreground"
                      aria-label={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}

                  <button
                    type="button"
                    onClick={() => handleToggleComplete(task)}
                    className="shrink-0"
                    aria-label={task.status === "DONE" ? "Mark incomplete" : "Mark complete"}
                  >
                    {task.status === "DONE" ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "text-sm",
                          task.status === "DONE" && "text-muted-foreground line-through"
                        )}
                      >
                        {task.title}
                      </span>
                      {task.recurrence && (
                        <Badge variant="secondary" className="text-xs">
                          {describeRecurrenceRule(task.recurrence)}
                        </Badge>
                      )}
                      {task.subtasks.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {doneSubtasks}/{task.subtasks.length} subtasks
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{PRIORITY_LABEL[task.priority]}</span>
                      {task.category && <span>· {task.category}</span>}
                      {task.dueDate && (
                        <span className={cn(overdue && "font-medium text-destructive")}>
                          · {overdue ? "Overdue: " : "Due "}
                          {formatDueDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <TaskFormDialog
                      mode="create"
                      parentTaskId={task.id}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Add subtask">
                          <Plus className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <TaskFormDialog
                      mode="edit"
                      task={task}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Edit task">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete task"
                      onClick={() => handleDelete(task)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {isExpanded && task.subtasks.length > 0 && (
                  <ul className="flex flex-col gap-1 border-t px-3 py-2 pl-12">
                    {task.subtasks.map((sub) => (
                      <li key={sub.id} className="flex items-center gap-3 py-1">
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(sub)}
                          className="shrink-0"
                          aria-label={sub.status === "DONE" ? "Mark incomplete" : "Mark complete"}
                        >
                          {sub.status === "DONE" ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                        <span
                          className={cn(
                            "flex-1 text-sm",
                            sub.status === "DONE" && "text-muted-foreground line-through"
                          )}
                        >
                          {sub.title}
                        </span>
                        <TaskFormDialog
                          mode="edit"
                          task={sub}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="Edit subtask">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete subtask"
                          onClick={() => handleDelete(sub)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
