"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Plus, Pencil } from "lucide-react"
import { TransactionFormDialog } from "./transaction-form-dialog"
import { BudgetFormDialog } from "./budget-form-dialog"
import { describeRecurrenceRule } from "@/lib/recurrence"
import type { BudgetView, MonthlySummary, TransactionView, UpcomingPayment } from "./finance-types"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(amount)
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number)
  return new Date(year, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })
}

function shiftMonth(month: string, direction: 1 | -1): string {
  const [year, m] = month.split("-").map(Number)
  const d = new Date(year, m - 1 + direction, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function formatDate(value: Date): string {
  return value.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function FinanceShell({
  month,
  transactions,
  budgets,
  summary,
  upcomingPayments,
}: {
  month: string
  transactions: TransactionView[]
  budgets: BudgetView[]
  summary: MonthlySummary
  upcomingPayments: UpcomingPayment[]
}) {
  const router = useRouter()

  function goToMonth(next: string) {
    router.push(`/finances?month=${next}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Finances</h1>
          <p className="text-sm text-muted-foreground">Manual income, expenses, and budgets</p>
        </div>
        <TransactionFormDialog
          mode="create"
          trigger={
            <Button>
              <Plus className="mr-1 h-4 w-4" />
              New transaction
            </Button>
          }
        />
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" onClick={() => goToMonth(shiftMonth(month, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="w-40 text-center font-medium">{formatMonthLabel(month)}</span>
        <Button variant="outline" size="icon" onClick={() => goToMonth(shiftMonth(month, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Income</p>
          <p className="mt-1 text-xl font-semibold text-emerald-600">
            {formatCurrency(summary.income)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Expenses</p>
          <p className="mt-1 text-xl font-semibold text-destructive">
            {formatCurrency(summary.expense)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Net</p>
          <p className={`mt-1 text-xl font-semibold ${summary.net >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {formatCurrency(summary.net)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Spending by category</h2>
            <BudgetFormDialog
              trigger={
                <Button variant="outline" size="sm">
                  <Plus className="mr-1 h-3 w-3" />
                  Budget
                </Button>
              }
            />
          </div>
          {summary.expenseByCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses this month.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {summary.expenseByCategory.map((c) => {
                const pct = c.budget ? Math.min(100, Math.round((c.amount / c.budget) * 100)) : null
                const overBudget = c.budget != null && c.amount > c.budget
                return (
                  <div key={c.category}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{c.category}</span>
                      <span className={overBudget ? "text-destructive" : "text-muted-foreground"}>
                        {formatCurrency(c.amount)}
                        {c.budget != null && ` / ${formatCurrency(c.budget)}`}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${overBudget ? "bg-destructive" : "bg-primary"}`}
                        style={{ width: `${pct ?? 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {budgets.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
              {budgets.map((b) => (
                <BudgetFormDialog
                  key={b.id}
                  budget={b}
                  trigger={
                    <button type="button" className="inline-flex">
                      <Badge variant="outline" className="cursor-pointer">
                        {b.category}: {formatCurrency(b.amount)}
                        <Pencil className="ml-1 h-3 w-3" />
                      </Badge>
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 font-medium">Upcoming payments</h2>
          {upcomingPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recurring transactions due in the next 30 days.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {upcomingPayments.map((p) => (
                <div
                  key={`${p.transactionId}-${p.nextDate}`}
                  className="flex items-center justify-between text-sm"
                >
                  <div>
                    <span className="font-medium">{p.category}</span>
                    <span className="ml-2 text-muted-foreground">
                      {describeRecurrenceRule(p.rule)}
                    </span>
                  </div>
                  <div className="text-right">
                    <div>{formatCurrency(p.amount)}</div>
                    <div className="text-xs text-muted-foreground">{p.nextDate}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-medium">Transactions</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions this month.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {transactions.map((t) => (
              <TransactionFormDialog
                key={t.id}
                mode="edit"
                transaction={t}
                trigger={
                  <button
                    type="button"
                    className="flex items-center justify-between gap-3 py-2 text-left text-sm hover:bg-muted/50"
                  >
                    <div>
                      <div className="font-medium">{t.category}</div>
                      {t.note && <div className="text-muted-foreground">{t.note}</div>}
                    </div>
                    <div className="text-right">
                      <div className={t.type === "INCOME" ? "text-emerald-600" : "text-destructive"}>
                        {t.type === "INCOME" ? "+" : "-"}
                        {formatCurrency(t.amount)}
                      </div>
                      <div className="text-xs text-muted-foreground">{formatDate(t.date)}</div>
                    </div>
                  </button>
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
