"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { RecurrenceRule } from "@/lib/recurrence"

const FREQ_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Every N days" },
] as const

export function RecurrenceFields({
  value,
  onChange,
}: {
  value: RecurrenceRule | null
  onChange: (rule: RecurrenceRule | null) => void
}) {
  const freq = value?.freq ?? "none"

  return (
    <div className="flex items-end gap-2">
      <div className="flex flex-1 flex-col gap-2">
        <Label>Repeats</Label>
        <Select
          value={freq}
          onValueChange={(next) => {
            if (next === "none") {
              onChange(null)
            } else {
              onChange({ freq: next as RecurrenceRule["freq"], interval: value?.interval ?? 1 })
            }
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQ_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {value && (
        <div className="flex w-24 flex-col gap-2">
          <Label>Every</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={value.interval}
            onChange={(e) =>
              onChange({ ...value, interval: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </div>
      )}
    </div>
  )
}
