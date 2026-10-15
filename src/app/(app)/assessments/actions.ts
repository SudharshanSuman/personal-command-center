
import { z } from "zod"
import { revalidatePath } from "@/local/shims/next-cache"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { suggestStudyBlocks, type Routine } from "@/lib/study-plan"

const AssessmentInputSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(200),
  title: z.string().trim().min(1, "Title is required").max(200),
  date: z.string().min(1, "Date is required"),
  location: z.string().trim().max(200).optional(),
  link: z.string().trim().max(500).optional(),
  syllabus: z.array(z.string().trim().min(1).max(200)).max(50),
  prepStatus: z.enum(["NOT_STARTED", "IN_PROGRESS", "REVIEW", "READY"]),
  importance: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  confidence: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().trim().max(5000).optional(),
  resultSummary: z.string().trim().max(1000).optional(),
})

export type AssessmentInput = z.infer<typeof AssessmentInputSchema>

async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated.")
  return user
}

async function requireOwnedAssessment(id: string, userId: string) {
  const assessment = await db.assessment.findUnique({ where: { id } })
  if (!assessment || assessment.userId !== userId) throw new Error("Assessment not found.")
  return assessment
}

function revalidateAssessmentViews() {
  revalidatePath("/assessments")
  revalidatePath("/dashboard")
  revalidatePath("/calendar")
}

export async function createAssessmentAction(input: AssessmentInput) {
  const user = await requireUser()
  const data = AssessmentInputSchema.parse(input)

  await db.assessment.create({
    data: {
      userId: user.id,
      subject: data.subject,
      title: data.title,
      date: new Date(data.date),
      location: data.location || null,
      link: data.link || null,
      syllabus: JSON.stringify(data.syllabus),
      prepStatus: data.prepStatus,
      importance: data.importance,
      confidence: data.confidence ?? null,
      notes: data.notes || null,
      resultSummary: data.resultSummary || null,
    },
  })

  revalidateAssessmentViews()
}

export async function updateAssessmentAction(id: string, input: AssessmentInput) {
  const user = await requireUser()
  await requireOwnedAssessment(id, user.id)
  const data = AssessmentInputSchema.parse(input)

  await db.assessment.update({
    where: { id },
    data: {
      subject: data.subject,
      title: data.title,
      date: new Date(data.date),
      location: data.location || null,
      link: data.link || null,
      syllabus: JSON.stringify(data.syllabus),
      prepStatus: data.prepStatus,
      importance: data.importance,
      confidence: data.confidence ?? null,
      notes: data.notes || null,
      resultSummary: data.resultSummary || null,
    },
  })

  revalidateAssessmentViews()
}

export async function deleteAssessmentAction(id: string) {
  const user = await requireUser()
  await requireOwnedAssessment(id, user.id)
  await db.assessment.delete({ where: { id } })
  revalidateAssessmentViews()
}

const SuggestSchema = z.object({
  assessmentId: z.string(),
  totalHours: z.number().min(0.5).max(200),
  sessionMinutes: z.number().int().min(15).max(240),
})

export type SuggestedBlockDTO = { startsAt: string; endsAt: string }

// Preview only — does not write anything. The caller must call
// confirmStudyBlocksAction with the (possibly user-edited) result to
// actually save blocks, per IA flow B's "review, adjust, confirm" step.
export async function generateStudyBlockSuggestionsAction(
  input: z.infer<typeof SuggestSchema>
): Promise<SuggestedBlockDTO[]> {
  const user = await requireUser()
  const data = SuggestSchema.parse(input)
  const assessment = await requireOwnedAssessment(data.assessmentId, user.id)

  const [profile, existingEvents] = await Promise.all([
    db.personalizationProfile.findUnique({ where: { userId: user.id } }),
    db.event.findMany({
      where: {
        userId: user.id,
        startsAt: { lt: assessment.date },
        endsAt: { gte: new Date() },
      },
      select: { startsAt: true, endsAt: true },
    }),
  ])

  let routine: Partial<Routine> | undefined
  if (profile?.routine) {
    try {
      routine = JSON.parse(profile.routine)
    } catch {
      routine = undefined
    }
  }

  const blocks = suggestStudyBlocks({
    now: new Date(),
    examDate: assessment.date,
    totalMinutes: Math.round(data.totalHours * 60),
    sessionMinutes: data.sessionMinutes,
    routine,
    existingEvents: existingEvents.map((e) => ({ start: e.startsAt, end: e.endsAt })),
  })

  return blocks.map((b) => ({ startsAt: b.startsAt.toISOString(), endsAt: b.endsAt.toISOString() }))
}

const ConfirmSchema = z.object({
  assessmentId: z.string(),
  blocks: z
    .array(z.object({ startsAt: z.string(), endsAt: z.string() }))
    .min(1, "No study blocks to save."),
})

export async function confirmStudyBlocksAction(input: z.infer<typeof ConfirmSchema>) {
  const user = await requireUser()
  const data = ConfirmSchema.parse(input)
  const assessment = await requireOwnedAssessment(data.assessmentId, user.id)

  await db.event.createMany({
    data: data.blocks.map((b) => ({
      userId: user.id,
      title: `Study: ${assessment.subject}`,
      type: "STUDY_SESSION" as const,
      startsAt: new Date(b.startsAt),
      endsAt: new Date(b.endsAt),
      allDay: false,
      assessmentId: assessment.id,
    })),
  })

  revalidateAssessmentViews()
}
