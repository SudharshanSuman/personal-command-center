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
import {
  createTransactionAction,
  updateTransactionAction,
  deleteTransactionAction,
  type TransactionInput,
} from "./actions"
import type { TransactionView } from "./finance-types"
import { parseRecurrenceRule } from "@/lib/recurrence"

function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toFormState(transaction?: TransactionView): TransactionInput {
  return {
    type: transaction?.type ?? "EXPENSE",
    amount: transaction?.amount ?? 0,
    category: transaction?.category ?? "",
    note: transaction?.note ?? "",
    date: transaction ? toDateInputValue(transaction.date) : toDateInputValue(new Date()),
    recurrence: transaction ? parseRecurrenceRule(transaction.recurrenceRule) : null,
  }
}

export function TransactionFormDialog({
  mode,
  transaction,
  trigger,
}: {
  mode: "create" | "edit"
  transaction?: TransactionView
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<TransactionInput>(() => toFormState(transaction))

  function resetOnOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setValues(toFormState(transaction))
      setError(null)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createTransactionAction(values)
        } else if (transaction) {
          await updateTransactionAction(transaction.id, values)
        }
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    })
  }

  function handleDelete() {
    if (!transaction) return
    if (!window.confirm("Delete this transaction?")) return
    startTransition(async () => {
      try {
        await deleteTransactionAction(transaction.id)
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
          <DialogTitle>{mode === "create" ? "New transaction" : "Edit transaction"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Type</Label>
              <Select
                value={values.type}
                onValueChange={(v) =>
                  setValues((s) => ({ ...s, type: v as TransactionInput["type"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="INCOME">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="txn-amount">Amount</Label>
              <Input
                id="txn-amount"
                type="number"
                min={0}
                step="0.01"
                value={values.amount}
                onChange={(e) =>
                  setValues((v) => ({ ...v, amount: Number(e.target.value) || 0 }))
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="txn-category">Category</Label>
              <Input
                id="txn-category"
                value={values.category}
                onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="txn-date">Date</Label>
              <Input
                id="txn-date"
                type="date"
                value={values.date}
                onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="txn-note">Note</Label>
            <Textarea
              id="txn-note"
              value={values.note ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))}
              rows={2}
            />
          </div>

          <RecurrenceFields
            value={values.recurrence}
            onChange={(rule) => setValues((v) => ({ ...v, recurrence: rule }))}
          />

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
