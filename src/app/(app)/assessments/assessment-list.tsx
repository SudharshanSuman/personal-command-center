"use client"

import { GraduationCap, Pencil, MapPin, Link as LinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { computeDeadlineRisk } from "@/lib/deadline-risk"
import { AssessmentFormDialog } from "./assessment-form-dialog"
import { StudyPlanDialog } from "./study-plan-dialog"
import type { AssessmentView } from "./assessment-types"

const IMPORTANCE_LABEL: Record<AssessmentView["importance"], string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
}

const PREP_STATUS_LABEL: Record<AssessmentView["prepStatus"], string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  REVIEW: "Review",
  READY: "Ready",
}

function daysUntil(date: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function countdownLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
  if (days === 0) return "Today"
  if (days === 1) return "Tomorrow"
  return `${days} days left`
}

function countdownClass(days: number): string {
  if (days < 0) return "text-muted-foreground"
  if (days <= 3) return "text-destructive"
  if (days <= 7) return "text-amber-600 dark:text-amber-400"
  return "text-foreground"
}

export function AssessmentList({ initialAssessments }: { initialAssessments: AssessmentView[] }) {
  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
          <p className="text-muted-foreground">
            {initialAssessments.length} upcoming or recent
          </p>
        </div>
        <AssessmentFormDialog
          mode="create"
          trigger={
            <Button className="gap-2">
              <GraduationCap className="h-4 w-4" />
              New assessment
            </Button>
          }
        />
      </div>

      {initialAssessments.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No assessments yet — add an exam or deadline to start a prep timeline.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {initialAssessments.map((assessment) => {
            const days = daysUntil(assessment.date)
            const risk = computeDeadlineRisk(days, assessment.prepStatus, assessment.studySessionCount)
            return (
              <Card key={assessment.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {assessment.subject}: {assessment.title}
                      </span>
                      <Badge
                        variant={assessment.importance === "URGENT" ? "destructive" : "secondary"}
                      >
                        {IMPORTANCE_LABEL[assessment.importance]}
                      </Badge>
                      <Badge variant="outline">{PREP_STATUS_LABEL[assessment.prepStatus]}</Badge>
                      {risk === "behind" && (
                        <Badge variant="destructive">Behind schedule</Badge>
                      )}
                      {risk === "on-track" && (
                        <Badge className="border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400" variant="outline">
                          On track
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {assessment.date.toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className={cn("font-medium", countdownClass(days))}>
                        {countdownLabel(days)}
                      </span>
                      {assessment.confidence && <span>Confidence: {assessment.confidence}/5</span>}
                      {assessment.studySessionCount > 0 && (
                        <span>{assessment.studySessionCount} study session{assessment.studySessionCount === 1 ? "" : "s"} scheduled</span>
                      )}
                    </div>
                    {assessment.location && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {assessment.location}
                      </p>
                    )}
                    {assessment.link && (
                      <a
                        href={assessment.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1 text-xs text-primary underline underline-offset-2"
                      >
                        <LinkIcon className="h-3 w-3" /> Link
                      </a>
                    )}
                    {assessment.syllabus.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {assessment.syllabus.map((topic) => (
                          <Badge key={topic} variant="secondary" className="text-[11px]">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {assessment.notes && (
                      <p className="mt-2 text-sm text-muted-foreground">{assessment.notes}</p>
                    )}
                    {assessment.resultSummary && (
                      <p className="mt-2 text-sm">
                        <span className="text-muted-foreground">Result: </span>
                        {assessment.resultSummary}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <AssessmentFormDialog
                      mode="edit"
                      assessment={assessment}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Edit assessment">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      }
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <StudyPlanDialog assessment={assessment} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
