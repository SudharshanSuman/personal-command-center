import * as chrono from "chrono-node"

// Deterministic date-extraction only (chrono-node) — no LLM, no full
// sentence understanding. Pulls the first date/time span chrono finds out
// of the text and treats whatever's left as the title. The type guess is a
// plain keyword check, not inferred meaning — it's a nudge shown to the
// user, never used to silently change what gets created.
export type QuickAddGuess = "TASK" | "ASSESSMENT"

export type QuickParseResult = {
  title: string
  dueDate: string | null // "YYYY-MM-DD"
  hasTime: boolean
  timeLabel: string | null // informational only — tasks track due dates, not times
  guess: QuickAddGuess
  matchedText: string | null
}

const ASSESSMENT_KEYWORDS = [
  "exam",
  "test",
  "quiz",
  "midterm",
  "final",
  "assessment",
  "viva",
  "practical",
]

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

export function parseQuickAddText(
  input: string,
  referenceDate: Date = new Date()
): QuickParseResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { title: "", dueDate: null, hasTime: false, timeLabel: null, guess: "TASK", matchedText: null }
  }

  const results = chrono.parse(trimmed, referenceDate)
  let title = trimmed
  let dueDate: string | null = null
  let hasTime = false
  let timeLabel: string | null = null
  let matchedText: string | null = null

  if (results.length > 0) {
    const match = results[0]
    const date = match.start.date()
    hasTime = match.start.isCertain("hour")
    dueDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    if (hasTime) {
      timeLabel = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    }
    matchedText = match.text

    const before = trimmed.slice(0, match.index)
    const after = trimmed.slice(match.index + match.text.length)
    title = `${before} ${after}`.replace(/\s+/g, " ").trim() || trimmed
  }

  const lowerTitle = title.toLowerCase()
  const guess: QuickAddGuess = ASSESSMENT_KEYWORDS.some((k) => lowerTitle.includes(k))
    ? "ASSESSMENT"
    : "TASK"

  return { title, dueDate, hasTime, timeLabel, guess, matchedText }
}
