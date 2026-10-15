
import { z } from "zod"
import { revalidatePath } from "@/local/shims/next-cache"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

const HabitInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(500).optional(),
  targetDaysPerWeek: z.number().int().min(1).max(7),
  active: z.boolean(),
})

export type HabitInput = z.infer<typeof HabitInputSchema>

async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated.")
  return user
}

async function requireOwnedHabit(id: string, userId: string) {
  const habit = await db.habit.findUnique({ where: { id } })
  if (!habit || habit.userId !== userId) throw new Error("Habit not found.")
  return habit
}

function revalidateHabitViews() {
  revalidatePath("/habits")
  revalidatePath("/dashboard")
  revalidatePath("/analytics")
}

export async function createHabitAction(input: HabitInput) {
  const user = await requireUser()
  const data = HabitInputSchema.parse(input)

  await db.habit.create({
    data: {
      userId: user.id,
      name: data.name,
      description: data.description || null,
      targetDaysPerWeek: data.targetDaysPerWeek,
      active: data.active,
    },
  })

  revalidateHabitViews()
}

export async function updateHabitAction(id: string, input: HabitInput) {
  const user = await requireUser()
  await requireOwnedHabit(id, user.id)
  const data = HabitInputSchema.parse(input)

  await db.habit.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      targetDaysPerWeek: data.targetDaysPerWeek,
      active: data.active,
    },
  })

  revalidateHabitViews()
}

export async function deleteHabitAction(id: string) {
  const user = await requireUser()
  await requireOwnedHabit(id, user.id)
  await db.habit.delete({ where: { id } })
  revalidateHabitViews()
}

const ToggleLogSchema = z.object({
  habitId: z.string(),
  date: z.string(), // "YYYY-MM-DD"
})

// A day with no HabitLog row means "not completed" — there's no separate
// explicit-false state to manage, so toggling off just deletes the row.
export async function toggleHabitLogAction(input: z.infer<typeof ToggleLogSchema>) {
  const user = await requireUser()
  const data = ToggleLogSchema.parse(input)
  await requireOwnedHabit(data.habitId, user.id)

  const day = new Date(`${data.date}T00:00:00`)
  const existing = await db.habitLog.findUnique({
    where: { habitId_date: { habitId: data.habitId, date: day } },
  })

  if (existing) {
    await db.habitLog.delete({ where: { id: existing.id } })
  } else {
    await db.habitLog.create({
      data: { habitId: data.habitId, date: day, completed: true },
    })
  }

  revalidateHabitViews()
}
