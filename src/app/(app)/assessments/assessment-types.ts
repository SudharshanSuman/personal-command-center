import type { Priority, PrepStatus } from "@/generated/prisma/enums"

export type AssessmentView = {
  id: string
  subject: string
  title: string
  date: Date
  location: string | null
  link: string | null
  syllabus: string[]
  prepStatus: PrepStatus
  importance: Priority
  confidence: number | null
  notes: string | null
  resultSummary: string | null
  studySessionCount: number
  reminders: { id: string; offsetMinutes: number }[]
}
