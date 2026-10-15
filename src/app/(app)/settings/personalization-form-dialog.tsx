"use client"

import { useState, useTransition, type ReactNode } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { updatePersonalizationAction, type PersonalizationInput } from "./actions"

const PRIORITY_OPTIONS = [
  "Academics",
  "Career",
  "Health & Fitness",
  "Relationships",
  "Finances",
  "Personal Growth",
  "Rest & Recreation",
]

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const

export function PersonalizationFormDialog({
  initialValues,
  trigger,
}: {
  initialValues: PersonalizationInput
  trigger: ReactNode
}) {
  const { setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<PersonalizationInput>(initialValues)

  function resetOnOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setValues(initialValues)
      setError(null)
    }
  }

  function updateRoutine(field: keyof PersonalizationInput["routine"], value: string) {
    setValues((v) => ({ ...v, routine: { ...v.routine, [field]: value } }))
  }

  function togglePriority(priority: string) {
    setValues((v) => ({
      ...v,
      priorities: v.priorities.includes(priority)
        ? v.priorities.filter((p) => p !== priority)
        : [...v.priorities, priority],
    }))
  }

  function addImportantDate() {
    setValues((v) => ({ ...v, importantDates: [...v.importantDates, { label: "", date: "" }] }))
  }

  function updateImportantDate(index: number, field: "label" | "date", value: string) {
    setValues((v) => ({
      ...v,
      importantDates: v.importantDates.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    }))
  }

  function removeImportantDate(index: number) {
    setValues((v) => ({ ...v, importantDates: v.importantDates.filter((_, i) => i !== index) }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await updatePersonalizationAction({
          ...values,
          importantDates: values.importantDates.filter((d) => d.label.trim() && d.date),
        })
        setTheme(values.theme)
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
          <DialogTitle>Edit personalization</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div>
            <Label className="mb-2 block">Routine</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="p-wake" className="text-xs text-muted-foreground">Wake up</Label>
                <Input
                  id="p-wake"
                  type="time"
                  value={values.routine.wake}
                  onChange={(e) => updateRoutine("wake", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="p-sleep" className="text-xs text-muted-foreground">Sleep</Label>
                <Input
                  id="p-sleep"
                  type="time"
                  value={values.routine.sleep}
                  onChange={(e) => updateRoutine("sleep", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="p-workStart" className="text-xs text-muted-foreground">Work/school starts</Label>
                <Input
                  id="p-workStart"
                  type="time"
                  value={values.routine.workStart}
                  onChange={(e) => updateRoutine("workStart", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="p-workEnd" className="text-xs text-muted-foreground">Work/school ends</Label>
                <Input
                  id="p-workEnd"
                  type="time"
                  value={values.routine.workEnd}
                  onChange={(e) => updateRoutine("workEnd", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Priorities</Label>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((priority) => {
                const selected = values.priorities.includes(priority)
                return (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => togglePriority(priority)}
                    aria-pressed={selected}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-accent"
                    )}
                  >
                    {priority}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Theme</Label>
            <div className="flex gap-2">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setValues((v) => ({ ...v, theme: option.value }))}
                  aria-pressed={values.theme === option.value}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm transition-colors",
                    values.theme === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-accent"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.notificationsEnabled}
              onChange={(e) => setValues((v) => ({ ...v, notificationsEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-border"
            />
            Enable reminder notifications
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="p-quietStart" className="text-xs text-muted-foreground">Quiet hours start</Label>
              <Input
                id="p-quietStart"
                type="time"
                value={values.quietHoursStart}
                onChange={(e) => setValues((v) => ({ ...v, quietHoursStart: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="p-quietEnd" className="text-xs text-muted-foreground">Quiet hours end</Label>
              <Input
                id="p-quietEnd"
                type="time"
                value={values.quietHoursEnd}
                onChange={(e) => setValues((v) => ({ ...v, quietHoursEnd: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Important dates</Label>
            {values.importantDates.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="Label"
                  value={entry.label}
                  onChange={(e) => updateImportantDate(index, "label", e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={entry.date}
                  onChange={(e) => updateImportantDate(index, "date", e.target.value)}
                  className="w-40"
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeImportantDate(index)}>
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addImportantDate} className="w-fit">
              Add a date
            </Button>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
