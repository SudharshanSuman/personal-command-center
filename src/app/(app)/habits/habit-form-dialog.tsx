"use client"

import { useState, useTransition, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createHabitAction, updateHabitAction, deleteHabitAction, type HabitInput } from "./actions"
import type { HabitView } from "./habit-types"

function toFormState(habit?: HabitView): HabitInput {
  return {
    name: habit?.name ?? "",
    description: habit?.description ?? "",
    targetDaysPerWeek: habit?.targetDaysPerWeek ?? 7,
    active: habit?.active ?? true,
  }
}

export function HabitFormDialog({
  mode,
  habit,
  trigger,
}: {
  mode: "create" | "edit"
  habit?: HabitView
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<HabitInput>(() => toFormState(habit))

  function resetOnOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setValues(toFormState(habit))
      setError(null)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createHabitAction(values)
        } else if (habit) {
          await updateHabitAction(habit.id, values)
        }
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    })
  }

  function handleDelete() {
    if (!habit) return
    if (!window.confirm(`Delete "${habit.name}"? Its history will be deleted too.`)) return
    startTransition(async () => {
      try {
        await deleteHabitAction(habit.id)
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={resetOnOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New habit" : "Edit habit"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="habit-name">Name</Label>
            <Input
              id="habit-name"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="habit-description">Description</Label>
            <Textarea
              id="habit-description"
              value={values.description ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="habit-target">Target days per week</Label>
            <Input
              id="habit-target"
              type="number"
              min={1}
              max={7}
              value={values.targetDaysPerWeek}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  targetDaysPerWeek: Math.min(7, Math.max(1, Number(e.target.value) || 1)),
                }))
              }
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.active}
              onChange={(e) => setValues((v) => ({ ...v, active: e.target.checked }))}
              className="h-4 w-4 rounded border-border"
            />
            Active
          </label>

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
