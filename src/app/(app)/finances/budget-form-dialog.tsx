"use client"

import { useState, useTransition, type ReactNode } from "react"
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
import { upsertBudgetAction, deleteBudgetAction, type BudgetInput } from "./actions"
import type { BudgetView } from "./finance-types"

function toFormState(budget?: BudgetView): BudgetInput {
  return {
    category: budget?.category ?? "",
    amount: budget?.amount ?? 0,
    period: "monthly",
  }
}

export function BudgetFormDialog({
  budget,
  trigger,
}: {
  budget?: BudgetView
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<BudgetInput>(() => toFormState(budget))

  function resetOnOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setValues(toFormState(budget))
      setError(null)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await upsertBudgetAction(values)
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    })
  }

  function handleDelete() {
    if (!budget) return
    if (!window.confirm(`Delete the budget for "${budget.category}"?`)) return
    startTransition(async () => {
      try {
        await deleteBudgetAction(budget.id)
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={resetOnOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{budget ? "Edit budget" : "New monthly budget"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="budget-category">Category</Label>
            <Input
              id="budget-category"
              value={values.category}
              onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
              required
              autoFocus
              disabled={!!budget}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="budget-amount">Monthly target</Label>
            <Input
              id="budget-amount"
              type="number"
              min={0}
              step="0.01"
              value={values.amount}
              onChange={(e) => setValues((v) => ({ ...v, amount: Number(e.target.value) || 0 }))}
              required
            />
          </div>

          <DialogFooter className="sm:justify-between">
            {budget && (
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
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
