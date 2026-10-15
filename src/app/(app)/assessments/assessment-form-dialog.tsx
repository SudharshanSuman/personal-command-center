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
import { ReminderRulesSection } from "@/components/reminder-rules-section"
import {
  createAssessmentAction,
  updateAssessmentAction,
  deleteAssessmentAction,
  type AssessmentInput,
} from "./actions"
import type { AssessmentView } from "./assessment-types"

function toDateInputValue(date: Date | null): string {
  if (!date) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toFormState(assessment?: AssessmentView): AssessmentInput {
  return {
    subject: assessment?.subject ?? "",
    title: assessment?.title ?? "",
    date: toDateInputValue(assessment?.date ?? null),
    location: assessment?.location ?? "",
    link: assessment?.link ?? "",
    syllabus: assessment?.syllabus ?? [],
    prepStatus: assessment?.prepStatus ?? "NOT_STARTED",
    importance: assessment?.importance ?? "MEDIUM",
    confidence: assessment?.confidence ?? null,
    notes: assessment?.notes ?? "",
    resultSummary: assessment?.resultSummary ?? "",
  }
}

export function AssessmentFormDialog({
  mode,
  assessment,
  trigger,
}: {
  mode: "create" | "edit"
  assessment?: AssessmentView
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<AssessmentInput>(() => toFormState(assessment))
  const [syllabusText, setSyllabusText] = useState(assessment?.syllabus.join(", ") ?? "")

  function resetOnOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setValues(toFormState(assessment))
      setSyllabusText(assessment?.syllabus.join(", ") ?? "")
      setError(null)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const payload: AssessmentInput = {
      ...values,
      syllabus: syllabusText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    }
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createAssessmentAction(payload)
        } else if (assessment) {
          await updateAssessmentAction(assessment.id, payload)
        }
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    })
  }

  function handleDelete() {
    if (!assessment) return
    if (!window.confirm(`Delete "${assessment.subject}: ${assessment.title}"? Any generated study sessions will be removed too.`)) return
    startTransition(async () => {
      try {
        await deleteAssessmentAction(assessment.id)
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
          <DialogTitle>{mode === "create" ? "New assessment" : "Edit assessment"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="a-subject">Subject</Label>
              <Input
                id="a-subject"
                value={values.subject}
                onChange={(e) => setValues((v) => ({ ...v, subject: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="a-title">Title</Label>
              <Input
                id="a-title"
                value={values.title}
                onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
                placeholder="Midterm, Final, Quiz 3..."
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="a-date">Date</Label>
              <Input
                id="a-date"
                type="date"
                value={values.date}
                onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="a-location">Location / link</Label>
              <Input
                id="a-location"
                value={values.location ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Importance</Label>
              <Select
                value={values.importance}
                onValueChange={(v) =>
                  setValues((s) => ({ ...s, importance: v as AssessmentInput["importance"] }))
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
            <div className="flex flex-col gap-2">
              <Label>Prep status</Label>
              <Select
                value={values.prepStatus}
                onValueChange={(v) =>
                  setValues((s) => ({ ...s, prepStatus: v as AssessmentInput["prepStatus"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOT_STARTED">Not started</SelectItem>
                  <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                  <SelectItem value="REVIEW">Review</SelectItem>
                  <SelectItem value="READY">Ready</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Confidence (1-5)</Label>
            <Select
              value={values.confidence ? String(values.confidence) : "none"}
              onValueChange={(v) =>
                setValues((s) => ({ ...s, confidence: v === "none" ? null : Number(v) }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not rated</SelectItem>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="a-syllabus">Syllabus / topics (comma-separated)</Label>
            <Input
              id="a-syllabus"
              value={syllabusText}
              onChange={(e) => setSyllabusText(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="a-notes">Notes</Label>
            <Textarea
              id="a-notes"
              value={values.notes ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
              rows={2}
            />
          </div>

          {mode === "edit" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="a-result">Result</Label>
              <Input
                id="a-result"
                value={values.resultSummary ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, resultSummary: e.target.value }))}
                placeholder="Fill in after the exam"
              />
            </div>
          )}

          {mode === "edit" && assessment && (
            <ReminderRulesSection
              targetType="ASSESSMENT"
              targetId={assessment.id}
              targetAt={assessment.date}
              rules={assessment.reminders}
              highImportance={values.importance === "HIGH" || values.importance === "URGENT"}
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
