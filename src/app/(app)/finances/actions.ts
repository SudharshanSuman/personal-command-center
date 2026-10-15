
import { z } from "zod"
import { revalidatePath } from "@/local/shims/next-cache"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { RecurrenceRuleSchema, stringifyRecurrenceRule } from "@/lib/recurrence"

const TransactionInputSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.number().positive("Amount must be greater than 0"),
  category: z.string().trim().min(1, "Category is required").max(100),
  note: z.string().trim().max(500).optional(),
  date: z.string().min(1, "Date is required"), // "YYYY-MM-DD"
  recurrence: RecurrenceRuleSchema.nullable(),
})

export type TransactionInput = z.infer<typeof TransactionInputSchema>

const BudgetInputSchema = z.object({
  category: z.string().trim().min(1, "Category is required").max(100),
  amount: z.number().positive("Amount must be greater than 0"),
  period: z.enum(["monthly", "yearly"]),
})

export type BudgetInput = z.infer<typeof BudgetInputSchema>

async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated.")
  return user
}

async function requireOwnedTransaction(id: string, userId: string) {
  const transaction = await db.transaction.findUnique({ where: { id } })
  if (!transaction || transaction.userId !== userId) throw new Error("Transaction not found.")
  return transaction
}

async function requireOwnedBudget(id: string, userId: string) {
  const budget = await db.budget.findUnique({ where: { id } })
  if (!budget || budget.userId !== userId) throw new Error("Budget not found.")
  return budget
}

function revalidateFinanceViews() {
  revalidatePath("/finances")
  revalidatePath("/dashboard")
  revalidatePath("/analytics")
}

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

export async function createTransactionAction(input: TransactionInput) {
  const user = await requireUser()
  const data = TransactionInputSchema.parse(input)

  await db.transaction.create({
    data: {
      userId: user.id,
      type: data.type,
      amount: data.amount,
      category: data.category,
      note: data.note || null,
      date: toDate(data.date),
      recurrenceRule: stringifyRecurrenceRule(data.recurrence),
    },
  })

  revalidateFinanceViews()
}

export async function updateTransactionAction(id: string, input: TransactionInput) {
  const user = await requireUser()
  await requireOwnedTransaction(id, user.id)
  const data = TransactionInputSchema.parse(input)

  await db.transaction.update({
    where: { id },
    data: {
      type: data.type,
      amount: data.amount,
      category: data.category,
      note: data.note || null,
      date: toDate(data.date),
      recurrenceRule: stringifyRecurrenceRule(data.recurrence),
    },
  })

  revalidateFinanceViews()
}

export async function deleteTransactionAction(id: string) {
  const user = await requireUser()
  await requireOwnedTransaction(id, user.id)
  await db.transaction.delete({ where: { id } })
  revalidateFinanceViews()
}

export async function upsertBudgetAction(input: BudgetInput) {
  const user = await requireUser()
  const data = BudgetInputSchema.parse(input)

  await db.budget.upsert({
    where: {
      userId_category_period: {
        userId: user.id,
        category: data.category,
        period: data.period,
      },
    },
    create: {
      userId: user.id,
      category: data.category,
      amount: data.amount,
      period: data.period,
    },
    update: {
      amount: data.amount,
    },
  })

  revalidateFinanceViews()
}

export async function deleteBudgetAction(id: string) {
  const user = await requireUser()
  await requireOwnedBudget(id, user.id)
  await db.budget.delete({ where: { id } })
  revalidateFinanceViews()
}
