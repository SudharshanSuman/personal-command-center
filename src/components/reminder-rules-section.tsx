"use client"

import { useState, useTransition } from "react"
import { Bell, Trash2, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { OFFSET_PRESETS, computeNominalFireTime } from "@/lib/reminders"
import {
  createReminderRuleAction,
  deleteReminderRuleAction,
  createEscalatingReminderRulesAction,
} from "@/app/(app)/settings/actions"

export type ReminderRuleItem = {
  id: string
  offsetMinutes: number
}

function offsetLabel(minutes: number): string {
  const preset = OFFSET_PRESETS.find((p) => p.minutes === minutes)
  if (preset) return preset.label
  if (minutes % (60 * 24) === 0) return `${minutes / (60 * 24)} day(s) before`
  if (minutes % 60 === 0) return `${minutes / 60} hour(s) before`
  return `${minutes} minutes before`
}

export function ReminderRulesSection({
  targetType,
  targetId,
  targetAt,
  rules,
  highImportance = false,
}: {
  targetType: "TASK" | "ASSESSMENT"
  targetId: string
  targetAt: Date | null
  rules: ReminderRuleItem[]
  highImportance?: boolean
}) {
  const [, startTransition] = useTransition()
  const [selectedOffset, setSelectedOffset] = useState<string>(String(OFFSET_PRESETS[2].minutes))

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Bell className="h-4 w-4 text-muted-foreground" />
        Reminders
      </div>

      {!targetAt ? (
        <p className="text-xs text-muted-foreground">
          Set a due date first — reminders are timed relative to it.
        </p>
      ) : (
        <>
          {rules.length > 0 && (
            <ul className="flex flex-col gap-1">
              {rules.map((rule) => (
                <li key={rule.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>
                    {offsetLabel(rule.offsetMinutes)} —{" "}
                    {computeNominalFireTime(targetAt, rule.offsetMinutes).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label="Remove reminder"
                    onClick={() => startTransition(() => deleteReminderRuleAction(rule.id))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2">
            <Label className="sr-only">Reminder offset</Label>
            <Select value={selectedOffset} onValueChange={setSelectedOffset}>
              <SelectTrigger className="h-8 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OFFSET_PRESETS.map((preset) => (
                  <SelectItem key={preset.minutes} value={String(preset.minutes)}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                startTransition(() =>
                  createReminderRuleAction({
                    targetType,
                    targetId,
                    offsetMinutes: Number(selectedOffset),
                  })
                )
              }
            >
              Add
            </Button>
          </div>

          {highImportance && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-fit gap-1.5"
              onClick={() =>
                startTransition(() =>
                  createEscalatingReminderRulesAction({ targetType, targetId })
                )
              }
            >
              <Zap className="h-3.5 w-3.5" />
              Escalate (3 days, 1 day, day-of)
            </Button>
          )}
        </>
      )}
    </div>
  )
}
