"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useAuth } from "@/local/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { completeOnboardingAction, type OnboardingInput } from "./actions"

const PRIORITY_OPTIONS = [
  "Academics",
  "Career",
  "Health & Fitness",
  "Relationships",
  "Finances",
  "Personal Growth",
  "Rest & Recreation",
]

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const

const STEPS = ["Routine", "Priorities", "Preferences", "Important dates"] as const

export function OnboardingWizard({
  userName,
  initialValues,
}: {
  userName: string | null
  initialValues: OnboardingInput
}) {
  const { setTheme } = useTheme()
  const router = useRouter()
  const { refresh } = useAuth()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<OnboardingInput>(initialValues)

  function updateRoutine(field: keyof OnboardingInput["routine"], value: string) {
    setValues((v) => ({ ...v, routine: { ...v.routine, [field]: value } }))
  }

  function togglePriority(priority: string) {
    setValues((v) => ({
      ...v,
      priorities: v.priorities.includes(priority)
        ? v.priorities.filter((p) => p !== priority)
        : [...v.priorities, priority],
    }))
  }

  function addImportantDate() {
    setValues((v) => ({
      ...v,
      importantDates: [...v.importantDates, { label: "", date: "" }],
    }))
  }

  function updateImportantDate(index: number, field: "label" | "date", value: string) {
    setValues((v) => ({
      ...v,
      importantDates: v.importantDates.map((d, i) =>
        i === index ? { ...d, [field]: value } : d
      ),
    }))
  }

  function removeImportantDate(index: number) {
    setValues((v) => ({
      ...v,
      importantDates: v.importantDates.filter((_, i) => i !== index),
    }))
  }

  function handleFinish() {
    setError(null)
    setTheme(values.theme)
    startTransition(async () => {
      try {
        await completeOnboardingAction({
          ...values,
          importantDates: values.importantDates.filter((d) => d.label.trim() && d.date),
        })
        await refresh()
        router.replace("/dashboard")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    })
  }

  const isLastStep = step === STEPS.length - 1

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>
          {userName ? `Welcome, ${userName}` : "Let's set up your command center"}
        </CardTitle>
        <CardDescription>
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </CardDescription>
        <div className="flex gap-1 pt-2">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={cn(
                "h-1 flex-1 rounded-full",
                i <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {step === 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="wake">Wake up</Label>
              <Input
                id="wake"
                type="time"
                value={values.routine.wake}
                onChange={(e) => updateRoutine("wake", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sleep">Sleep</Label>
              <Input
                id="sleep"
                type="time"
                value={values.routine.sleep}
                onChange={(e) => updateRoutine("sleep", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="workStart">Work/school starts</Label>
              <Input
                id="workStart"
                type="time"
                value={values.routine.workStart}
                onChange={(e) => updateRoutine("workStart", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="workEnd">Work/school ends</Label>
              <Input
                id="workEnd"
                type="time"
                value={values.routine.workEnd}
                onChange={(e) => updateRoutine("workEnd", e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="mb-3 text-sm text-muted-foreground">
              Pick what matters most right now. This shapes how the dashboard
              prioritizes what it shows you.
            </p>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((priority) => {
                const selected = values.priorities.includes(priority)
                return (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => togglePriority(priority)}
                    aria-pressed={selected}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-accent"
                    )}
                  >
                    {priority}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <Label className="mb-2 block">Theme</Label>
              <div className="flex gap-2">
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setValues((v) => ({ ...v, theme: option.value }))}
                    aria-pressed={values.theme === option.value}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-2 text-sm transition-colors",
                      values.theme === option.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-accent"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.notificationsEnabled}
                onChange={(e) =>
                  setValues((v) => ({ ...v, notificationsEnabled: e.target.checked }))
                }
                className="h-4 w-4 rounded border-border"
              />
              Enable reminder notifications
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="quietStart">Quiet hours start</Label>
                <Input
                  id="quietStart"
                  type="time"
                  value={values.quietHoursStart}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, quietHoursStart: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="quietEnd">Quiet hours end</Label>
                <Input
                  id="quietEnd"
                  type="time"
                  value={values.quietHoursEnd}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, quietHoursEnd: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Optional — add any dates worth keeping in view (a big deadline, a
              trip, anything). You can always add more later.
            </p>
            {values.importantDates.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="Label"
                  value={entry.label}
                  onChange={(e) => updateImportantDate(index, "label", e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={entry.date}
                  onChange={(e) => updateImportantDate(index, "date", e.target.value)}
                  className="w-40"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeImportantDate(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addImportantDate}>
              Add a date
            </Button>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button
          type="button"
          variant="ghost"
          disabled={step === 0 || isPending}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </Button>
        {isLastStep ? (
          <Button type="button" onClick={handleFinish} disabled={isPending}>
            {isPending ? "Saving..." : "Finish"}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          >
            Next
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
