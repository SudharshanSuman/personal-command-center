"use client"

import { useState, useTransition, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { RecurrenceFields } from "@/components/recurrence-fields"
import { ReminderRulesSection } from "@/components/reminder-rules-section"
import type { RecurrenceRule } from "@/lib/recurrence"
import { createTaskAction, updateTaskAction, type TaskInput } from "./actions"
import type { TaskView } from "./task-types"

// Builds the string from local date components — `.toISOString()` converts
// to UTC first, which rolls local midnight back a day in timezones ahead of
// UTC (same bug class as toDateParam in src/lib/calendar-dates.ts).
function toDateInputValue(date: Date | null): string {
  if (!date) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toFormState(task?: TaskView, parentTaskId?: string): TaskInput {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "TODO",
    priority: task?.priority ?? "MEDIUM",
    category: task?.category ?? "",
    tags: task?.tags ?? [],
    dueDate: toDateInputValue(task?.dueDate ?? null),
    progress: task?.progress ?? 0,
    estimatedMinutes: task?.estimatedMinutes ?? null,
    actualMinutes: task?.actualMinutes ?? null,
    recurrence: task?.recurrence ?? null,
    parentTaskId: task?.parentTaskId ?? parentTaskId ?? null,
  }
}

export function TaskFormDialog({
  mode,
  task,
  parentTaskId,
  trigger,
}: {
  mode: "create" | "edit"
  task?: TaskView
  parentTaskId?: string
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<TaskInput>(() => toFormState(task, parentTaskId))
  const [tagsText, setTagsText] = useState(task?.tags.join(", ") ?? "")

  function resetOnOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setValues(toFormState(task, parentTaskId))
      setTagsText(task?.tags.join(", ") ?? "")
      setError(null)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const payload: TaskInput = {
      ...values,
      tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    }

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createTaskAction(payload)
        } else if (task) {
          await updateTaskAction(task.id, payload)
        }
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={resetOnOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? (parentTaskId ? "Add subtask" : "New task") : "Edit task"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={values.title}
              onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Notes</Label>
            <Textarea
              id="description"
              value={values.description ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select
                value={values.status}
                onValueChange={(v) =>
                  setValues((s) => ({ ...s, status: v as TaskInput["status"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">To do</SelectItem>
                  <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                  <SelectItem value="DONE">Done</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Priority</Label>
              <Select
                value={values.priority}
                onValueChange={(v) =>
                  setValues((s) => ({ ...s, priority: v as TaskInput["priority"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input
                id="dueDate"
                type="date"
                value={values.dueDate ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, dueDate: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={values.category ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input id="tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="progress">Progress %</Label>
              <Input
                id="progress"
                type="number"
                min={0}
                max={100}
                value={values.progress}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    progress: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="estimatedMinutes">Est. minutes</Label>
              <Input
                id="estimatedMinutes"
                type="number"
                min={0}
                value={values.estimatedMinutes ?? ""}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    estimatedMinutes: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="actualMinutes">Actual minutes</Label>
              <Input
                id="actualMinutes"
                type="number"
                min={0}
                value={values.actualMinutes ?? ""}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    actualMinutes: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </div>
          </div>

          <RecurrenceFields
            value={values.recurrence}
            onChange={(rule: RecurrenceRule | null) =>
              setValues((v) => ({ ...v, recurrence: rule }))
            }
          />

          {mode === "edit" && task && (
            <ReminderRulesSection
              targetType="TASK"
              targetId={task.id}
              targetAt={task.dueDate}
              rules={task.reminders}
              highImportance={values.priority === "HIGH" || values.priority === "URGENT"}
            />
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : mode === "create" ? "Create" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
