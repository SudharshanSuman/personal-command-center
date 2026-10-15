"use client"

import { useTransition } from "react"
import { Circle } from "lucide-react"
import { setTaskStatusAction } from "@/app/(app)/tasks/actions"
import type { Priority } from "@/generated/prisma/enums"

export type PriorityTaskItem = {
  id: string
  title: string
  priority: Priority
}

export function PriorityTaskList({ tasks }: { tasks: PriorityTaskItem[] }) {
  const [, startTransition] = useTransition()

  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center gap-2 text-sm">
          <button
            type="button"
            aria-label="Mark complete"
            onClick={() => startTransition(() => setTaskStatusAction(task.id, "DONE"))}
            className="shrink-0"
          >
            <Circle className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
          </button>
          <span className="flex-1">{task.title}</span>
          <span className="text-xs text-muted-foreground">
            {task.priority === "URGENT" ? "Urgent" : "High"}
          </span>
        </li>
      ))}
    </ul>
  )
}
