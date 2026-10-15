"use client"

import { useState, useTransition, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import type { RecurrenceRule } from "@/lib/recurrence"
import { createEventAction, updateEventAction, deleteEventAction, type EventInput } from "./actions"
import type { EventView, TaskOption } from "./event-types"

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

function defaultStart(anchor?: Date): Date {
  const d = anchor ? new Date(anchor) : new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return d
}

function toFormState(event?: EventView, anchor?: Date): EventInput {
  const start = event?.startsAt ?? defaultStart(anchor)
  const end = event?.endsAt ?? new Date(start.getTime() + 60 * 60 * 1000)
  return {
    title: event?.title ?? "",
    type: event?.type ?? "EVENT",
    startsAt: toLocalInputValue(start),
    endsAt: toLocalInputValue(end),
    allDay: event?.allDay ?? false,
    location: event?.location ?? "",
    recurrence: event?.recurrence ?? null,
    taskId: event?.taskId ?? null,
  }
}

export function EventFormDialog({
  mode,
  event,
  anchorDate,
  taskOptions,
  trigger,
}: {
  mode: "create" | "edit"
  event?: EventView
  anchorDate?: Date
  taskOptions: TaskOption[]
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<EventInput>(() => toFormState(event, anchorDate))

  function resetOnOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setValues(toFormState(event, anchorDate))
      setError(null)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createEventAction(values)
        } else if (event) {
          await updateEventAction(event.id, values)
        }
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    })
  }

  function handleDelete() {
    if (!event) return
    if (!window.confirm(`Delete "${event.title}"?`)) return
    startTransition(async () => {
      try {
        await deleteEventAction(event.id)
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
          <DialogTitle>{mode === "create" ? "New event" : "Edit event"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={values.title}
              onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <Select
              value={values.type}
              onValueChange={(v) => setValues((s) => ({ ...s, type: v as EventInput["type"] }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EVENT">Event</SelectItem>
                <SelectItem value="TIME_BLOCK">Time block</SelectItem>
                <SelectItem value="STUDY_SESSION">Study session</SelectItem>
                <SelectItem value="HABIT_BLOCK">Habit block</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.allDay}
              onChange={(e) => setValues((v) => ({ ...v, allDay: e.target.checked }))}
              className="h-4 w-4 rounded border-border"
            />
            All day
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-start">Starts</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={values.startsAt}
                onChange={(e) => setValues((v) => ({ ...v, startsAt: e.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-end">Ends</Label>
              <Input
                id="event-end"
                type="datetime-local"
                value={values.endsAt}
                onChange={(e) => setValues((v) => ({ ...v, endsAt: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="event-location">Location</Label>
            <Input
              id="event-location"
              value={values.location ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Linked task (optional)</Label>
            <Select
              value={values.taskId ?? "none"}
              onValueChange={(v) => setValues((s) => ({ ...s, taskId: v === "none" ? null : v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {taskOptions.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === "create" && (
            <RecurrenceFields
              value={values.recurrence}
              onChange={(rule: RecurrenceRule | null) =>
                setValues((v) => ({ ...v, recurrence: rule }))
              }
            />
          )}

          <DialogFooter className="sm:justify-between">
            {mode === "edit" && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                Delete
              </Button>
            )}
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : mode === "create" ? "Create" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
