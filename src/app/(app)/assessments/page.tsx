"use client"

import { db } from "@/lib/db"
import { useAuth } from "@/local/auth-context"
import { useLocalData } from "@/local/use-local-data"
import { AssessmentList } from "./assessment-list"
import type { AssessmentView } from "./assessment-types"

export default function AssessmentsPage() {
  const { user } = useAuth()
  const { data, loading } = useLocalData(async () => {
    if (!user) return null
    const assessments = await db.assessment.findMany({
      where: { userId: user.id },
      include: {
        events: { where: { type: "STUDY_SESSION" }, select: { id: true } },
        reminderRules: { select: { id: true, offsetMinutes: true } },
      },
      orderBy: { date: "asc" },
    })

    const views: AssessmentView[] = assessments.map((a) => {
      let syllabus: string[] = []
      try {
        syllabus = a.syllabus ? JSON.parse(a.syllabus) : []
      } catch {
        syllabus = []
      }
      return {
        id: a.id,
        subject: a.subject,
        title: a.title,
        date: a.date,
        location: a.location,
        link: a.link,
        syllabus,
        prepStatus: a.prepStatus,
        importance: a.importance,
        confidence: a.confidence,
        notes: a.notes,
        resultSummary: a.resultSummary,
        studySessionCount: a.events.length,
        reminders: a.reminderRules,
      }
    })
    return views
  }, [user?.id])

  if (loading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }
  return <AssessmentList initialAssessments={data} />
}
