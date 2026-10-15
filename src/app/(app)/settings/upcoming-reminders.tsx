"use client"

import { useTransition } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { deleteReminderRuleAction } from "./actions"

export type UpcomingReminderItem = {
  id: string
  targetTitle: string
  offsetLabel: string
  effectiveTime: Date
  heldForQuietHours: boolean
}

export function UpcomingReminders({ items }: { items: UpcomingReminderItem[] }) {
  const [, startTransition] = useTransition()

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No reminders set yet — add one from a task or assessment&apos;s edit dialog.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
          <div className="min-w-0">
            <p className="truncate">{item.targetTitle}</p>
            <p className="text-xs text-muted-foreground">
              {item.offsetLabel} —{" "}
              {item.effectiveTime.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {item.heldForQuietHours && (
                <Badge variant="outline" className="ml-2 text-[10px]">
                  held for quiet hours
                </Badge>
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Delete reminder"
            onClick={() => startTransition(() => deleteReminderRuleAction(item.id))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  )
}
