"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { submitPeriodReviewAction } from "./actions"
import type { ExistingReviewDraft, PeriodSnapshot } from "./review-types"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(amount)
}

const PREP_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  REVIEW: "Reviewing",
  READY: "Ready",
}

export function PeriodReview({
  period,
  dateKey,
  label,
  snapshot,
  initialDraft,
}: {
  period: "WEEKLY" | "MONTHLY"
  dateKey: string
  label: string
  snapshot: PeriodSnapshot
  initialDraft: ExistingReviewDraft
}) {
  const [isPending, startTransition] = useTransition()
  const [wentWell, setWentWell] = useState(initialDraft.wentWell)
  const [needsAttention, setNeedsAttention] = useState(initialDraft.needsAttention)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const completionRate =
    snapshot.taskCompletion.total > 0
      ? Math.round((snapshot.taskCompletion.completed / snapshot.taskCompletion.total) * 100)
      : null

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await submitPeriodReviewAction({ period, date: dateKey, wentWell, needsAttention })
        setSaved(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    })
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">{label}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-medium">Task completion</h2>
          <p className="text-2xl font-semibold">
            {completionRate !== null ? `${completionRate}%` : "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            {snapshot.taskCompletion.completed}/{snapshot.taskCompletion.total} due this period
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-medium">Money snapshot</h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Income</span>
            <span className="text-emerald-600">{formatCurrency(snapshot.money.income)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Expenses</span>
            <span className="text-destructive">{formatCurrency(snapshot.money.expense)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-border pt-1 text-sm font-medium">
            <span>Net</span>
            <span className={snapshot.money.net >= 0 ? "text-emerald-600" : "text-destructive"}>
              {formatCurrency(snapshot.money.net)}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-medium">Goals progress</h2>
          {snapshot.goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active goals.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {snapshot.goals.map((g) => (
                <div key={g.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{g.title}</span>
                  <span className="text-muted-foreground">{g.progress}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-medium">Habit consistency</h2>
          {snapshot.habits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active habits.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {snapshot.habits.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{h.name}</span>
                  <span className="text-muted-foreground">{h.consistency}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-medium">Assessments this period</h2>
          {snapshot.assessments.length === 0 ? (
            <p className="text-sm text-muted-foreground">None scheduled.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {snapshot.assessments.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">
                    {a.subject} — {a.title}
                  </span>
                  <span className="text-muted-foreground">
                    {PREP_STATUS_LABEL[a.prepStatus] ?? a.prepStatus}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-medium">Upcoming deadlines</h2>
          {snapshot.upcomingDeadlines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due in the next week.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {snapshot.upcomingDeadlines.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{d.title}</span>
                  <span className="text-muted-foreground">{d.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-medium">Reflection</h2>
        {error && (
          <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {saved && (
          <p className="mb-3 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">Saved.</p>
        )}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="period-went-well">Key achievements</Label>
            <Textarea
              id="period-went-well"
              value={wentWell}
              onChange={(e) => {
                setWentWell(e.target.value)
                setSaved(false)
              }}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="period-needs-attention">Problems & priorities for next period</Label>
            <Textarea
              id="period-needs-attention"
              value={needsAttention}
              onChange={(e) => {
                setNeedsAttention(e.target.value)
                setSaved(false)
              }}
              rows={3}
            />
          </div>
          <Button onClick={handleSave} disabled={isPending} className="w-fit">
            {isPending ? "Saving..." : "Save review"}
          </Button>
        </div>
      </div>
    </div>
  )
}
