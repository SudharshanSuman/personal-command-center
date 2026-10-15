import type { GoalStatus, GoalTimeframe, TaskStatus } from "@/generated/prisma/enums"

export type LinkedTask = {
  id: string
  title: string
  status: TaskStatus
}

export type GoalView = {
  id: string
  title: string
  description: string | null
  timeframe: GoalTimeframe
  status: GoalStatus
  targetDate: Date | null
  progress: number
  tasks: LinkedTask[]
}

export type UnlinkedTaskOption = { id: string; title: string }
