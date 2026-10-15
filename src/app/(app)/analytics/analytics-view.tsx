import { Flame, Lightbulb } from "lucide-react"
import type { Insight } from "@/lib/insights"
import type { HabitConsistencyRow, SpendingCategoryRow, TaskTrendDay } from "./analytics-types"

const CHART_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
]

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(amount)
}

function formatDayLabel(dateKey: string): string {
  const [, m, d] = dateKey.split("-").map(Number)
  return new Date(2000, m - 1, d).toLocaleDateString(undefined, { weekday: "narrow" })
}

function TaskTrendChart({ trend }: { trend: TaskTrendDay[] }) {
  return (
    <div className="flex h-32 items-end gap-1.5">
      {trend.map((day) => (
        <div key={day.dateKey} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-24 w-full items-end overflow-hidden rounded-sm bg-muted">
            {day.rate !== null && (
              <div
                className="w-full rounded-sm bg-chart-1"
                style={{ height: `${Math.max(day.rate, 4)}%` }}
                title={`${day.completed}/${day.total} done`}
              />
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">{formatDayLabel(day.dateKey)}</span>
        </div>
      ))}
    </div>
  )
}

function HabitConsistencyList({ rows }: { rows: HabitConsistencyRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No active habits yet.</p>
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.id}>
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1">
              {row.name}
              {row.currentStreak > 0 && (
                <span className="inline-flex items-center gap-0.5 text-xs text-orange-500">
                  <Flame className="h-3 w-3" />
                  {row.currentStreak}
                </span>
              )}
            </span>
            <span className="text-muted-foreground">{row.consistency30d}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-chart-2" style={{ width: `${row.consistency30d}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function SpendingChart({ rows }: { rows: SpendingCategoryRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No expenses recorded this month.</p>
  }
  const max = Math.max(...rows.map((r) => r.amount))
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div key={row.category} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 truncate">{row.category}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${CHART_COLORS[i % CHART_COLORS.length]}`}
              style={{ width: `${(row.amount / max) * 100}%` }}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-muted-foreground">
            {formatCurrency(row.amount)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function AnalyticsView({
  taskTrend,
  overallTaskCompletionRate,
  habitRows,
  overallHabitConsistency,
  spendingByCategory,
  insights,
}: {
  taskTrend: TaskTrendDay[]
  overallTaskCompletionRate: number | null
  habitRows: HabitConsistencyRow[]
  overallHabitConsistency: number | null
  spendingByCategory: SpendingCategoryRow[]
  insights: Insight[]
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Trends computed from your own task, habit, and transaction data
        </p>
      </div>

      {insights.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-1.5 font-medium">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Insights
          </h2>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {insights.map((insight) => (
              <li key={insight.id}>{insight.text}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Task completion — last 14 days</h2>
            <span className="text-lg font-semibold">
              {overallTaskCompletionRate !== null ? `${overallTaskCompletionRate}%` : "—"}
            </span>
          </div>
          {taskTrend.some((d) => d.total > 0) ? (
            <TaskTrendChart trend={taskTrend} />
          ) : (
            <p className="text-sm text-muted-foreground">No tasks due in the last 14 days.</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Habit consistency — last 30 days</h2>
            <span className="text-lg font-semibold">
              {overallHabitConsistency !== null ? `${overallHabitConsistency}%` : "—"}
            </span>
          </div>
          <HabitConsistencyList rows={habitRows} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-medium">Spending by category — this month</h2>
        <SpendingChart rows={spendingByCategory} />
      </div>
    </div>
  )
}
