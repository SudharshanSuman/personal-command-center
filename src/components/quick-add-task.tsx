"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Plus, Sparkles } from "lucide-react"
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
import { quickAddTaskAction } from "@/app/(app)/tasks/actions"
import { parseQuickAddText, type QuickAddGuess } from "@/lib/quick-parse"

export function QuickAddTask({
  className,
  iconOnly = false,
}: {
  className?: string
  iconOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM")
  const [smartText, setSmartText] = useState("")
  const [parsedGuess, setParsedGuess] = useState<QuickAddGuess | null>(null)
  const [parsedTimeLabel, setParsedTimeLabel] = useState<string | null>(null)
  const [parsedMatch, setParsedMatch] = useState<string | null>(null)

  function reset() {
    setTitle("")
    setDueDate("")
    setPriority("MEDIUM")
    setSmartText("")
    setParsedGuess(null)
    setParsedTimeLabel(null)
    setParsedMatch(null)
    setError(null)
    setSaved(false)
  }

  // Parses into the same title/dueDate fields below rather than saving
  // directly — the user always sees and can edit the result before "Add
  // task" actually creates anything.
  function handleParse() {
    if (!smartText.trim()) return
    const result = parseQuickAddText(smartText)
    setTitle(result.title)
    setDueDate(result.dueDate ?? "")
    setParsedGuess(result.guess)
    setParsedTimeLabel(result.timeLabel)
    setParsedMatch(result.matchedText)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await quickAddTaskAction({ title, dueDate: dueDate || undefined, priority })
        setSaved(true)
        setTimeout(() => {
          setOpen(false)
          reset()
        }, 500)
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
        <Button
          type="button"
          variant={iconOnly ? "default" : "outline"}
          size={iconOnly ? "icon" : "default"}
          className={className}
          aria-label={iconOnly ? "Quick add task" : undefined}
        >
          <Plus className="h-4 w-4" />
          {!iconOnly && "Quick add"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Quick add task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
            <Label htmlFor="quick-smart" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Try natural language, e.g. &quot;physics exam in 12 days&quot;
            </Label>
            <div className="flex gap-2">
              <Input
                id="quick-smart"
                value={smartText}
                onChange={(e) => setSmartText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleParse()
                  }
                }}
                placeholder="gym tomorrow 6am"
              />
              <Button type="button" variant="secondary" onClick={handleParse} disabled={!smartText.trim()}>
                Parse
              </Button>
            </div>
            {parsedGuess && (
              <div className="text-xs text-muted-foreground">
                Parsed into the fields below
                {parsedMatch && <> — matched &quot;{parsedMatch}&quot;</>}
                {parsedTimeLabel && <> (around {parsedTimeLabel}, tasks track a due date only)</>}
                .
                {parsedGuess === "ASSESSMENT" && (
                  <>
                    {" "}
                    This reads like an assessment —{" "}
                    <Link href="/assessments" className="underline">
                      create it on the Assessments page
                    </Link>{" "}
                    instead for exam-specific fields?
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="quick-title">Title</Label>
            <Input
              id="quick-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="quick-due">Due date</Label>
              <Input
                id="quick-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
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
          <DialogFooter>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {saved ? "Added ✓" : isPending ? "Adding..." : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
