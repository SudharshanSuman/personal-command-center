"use client"

import { useState, useTransition } from "react"
import { CalendarPlus, Trash2 } from "lucide-react"
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
import {
  generateStudyBlockSuggestionsAction,
  confirmStudyBlocksAction,
  type SuggestedBlockDTO,
} from "./actions"
import type { AssessmentView } from "./assessment-types"

function toLocalInputValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInputValue(value: string): string {
  return new Date(value).toISOString()
}

function formatBlock(block: SuggestedBlockDTO): string {
  const start = new Date(block.startsAt)
  const end = new Date(block.endsAt)
  return `${start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}, ${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
}

export function StudyPlanDialog({ assessment }: { assessment: AssessmentView }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [totalHours, setTotalHours] = useState(8)
  const [sessionMinutes, setSessionMinutes] = useState(90)
  const [suggestions, setSuggestions] = useState<SuggestedBlockDTO[] | null>(null)
  const [saved, setSaved] = useState(false)

  function reset() {
    setSuggestions(null)
    setError(null)
    setSaved(false)
  }

  function handleSuggest() {
    setError(null)
    startTransition(async () => {
      try {
        const blocks = await generateStudyBlockSuggestionsAction({
          assessmentId: assessment.id,
          totalHours,
          sessionMinutes,
        })
        if (blocks.length === 0) {
          setError(
            "Couldn't fit any study blocks before this date — try fewer hours, a shorter session length, or check your calendar isn't fully booked."
          )
        }
        setSuggestions(blocks)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    })
  }

  function updateBlock(index: number, field: "startsAt" | "endsAt", localValue: string) {
    setSuggestions((prev) =>
      prev
        ? prev.map((b, i) => (i === index ? { ...b, [field]: fromLocalInputValue(localValue) } : b))
        : prev
    )
  }

  function removeBlock(index: number) {
    setSuggestions((prev) => (prev ? prev.filter((_, i) => i !== index) : prev))
  }

  function handleConfirm() {
    if (!suggestions || suggestions.length === 0) return
    setError(null)
    startTransition(async () => {
      try {
        await confirmStudyBlocksAction({ assessmentId: assessment.id, blocks: suggestions })
        setSaved(true)
        setTimeout(() => {
          setOpen(false)
          reset()
        }, 700)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarPlus className="h-4 w-4" />
          Suggest study blocks
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Study plan for {assessment.subject}</DialogTitle>
        </DialogHeader>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {!suggestions ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              We&apos;ll spread your study time across evenings and weekends between now
              and {assessment.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })},
              skipping anything already on your calendar.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="total-hours">Total prep hours</Label>
                <Input
                  id="total-hours"
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={totalHours}
                  onChange={(e) => setTotalHours(Number(e.target.value) || 0)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="session-minutes">Session length (min)</Label>
                <Input
                  id="session-minutes"
                  type="number"
                  min={15}
                  step={15}
                  value={sessionMinutes}
                  onChange={(e) => setSessionMinutes(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleSuggest} disabled={isPending}>
                {isPending ? "Thinking..." : "Suggest blocks"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {suggestions.length} block{suggestions.length === 1 ? "" : "s"} suggested. Adjust
              times or remove any, then confirm to add them to your calendar.
            </p>
            <ul className="flex flex-col gap-2">
              {suggestions.map((block, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md border p-2">
                  <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                    <Input
                      type="datetime-local"
                      value={toLocalInputValue(block.startsAt)}
                      onChange={(e) => updateBlock(i, "startsAt", e.target.value)}
                      className="text-xs"
                    />
                    <span className="text-xs text-muted-foreground sm:hidden">to</span>
                    <Input
                      type="datetime-local"
                      value={toLocalInputValue(block.endsAt)}
                      onChange={(e) => updateBlock(i, "endsAt", e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {formatBlock(block)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove block"
                    onClick={() => removeBlock(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setSuggestions(null)}>
                Back
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={isPending || suggestions.length === 0}
              >
                {saved ? "Added ✓" : isPending ? "Saving..." : "Confirm & add to calendar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
