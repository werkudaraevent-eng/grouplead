/**
 * Tanya AI's conversations: the pure rules around a kept chat.
 *
 * A question and its answer used to live only in the open panel, so closing
 * it or walking to another page threw the thread away and the next question
 * started from nothing. A chat pane that a person returns to is expected to
 * remember (Copilot, ChatGPT's side panes, Gemini in Workspace), so a
 * conversation is a row of its own: a title taken from the first question,
 * the turns as they were asked, and nothing else.
 *
 * Everything here is pure and safe on either side: the panel uses it to
 * label a row in Riwayat, the server actions use it to shape what they
 * store and what the model is given as context.
 */

import { wibDayOf } from "./insight-facts"

/** One exchange: what was asked, what came back, and when it was asked. */
export interface AskTurn {
  question: string
  answer: string
  /** ISO instant. */
  askedAt: string
}

/** A row as Riwayat lists it: enough to choose one, never the whole thread. */
export interface ConversationSummary {
  id: string
  title: string
  updatedAt: string
  turnCount: number
}

/** A thread as the panel continues it. */
export interface Conversation {
  id: string
  title: string
  turns: AskTurn[]
}

/** The title is the first question, cut where a list row stops reading it. */
export const CONVERSATION_TITLE_MAX = 80
/** How many earlier turns the model is given, the same few that used to live in the panel's state. */
export const CONVERSATION_HISTORY_TURNS = 3
/** How many turns a row keeps: a long sitting stays one row, and the row stays small. */
export const CONVERSATION_TURNS_KEPT = 40
/** How many conversations Riwayat offers; older ones are still there until the sweep. */
export const CONVERSATION_LIST_LIMIT = 30
/** A question is a note, not a record: after this the sweep deletes it. */
export const CONVERSATION_RETENTION_DAYS = 90

/** Two sentences of answer is plenty to keep; a model that rambles does not grow the row without end. */
const MAX_ANSWER = 4000
/** The field's own limit, applied again here because a stored row outlives the form. */
const MAX_QUESTION = 300

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

/** The first question as the thread's name, on one line and cut to the list's width. */
export function conversationTitle(question: string): string {
  const text = collapse(question)
  if (!text) return "Percakapan"
  return text.length > CONVERSATION_TITLE_MAX ? `${text.slice(0, CONVERSATION_TITLE_MAX - 1).trimEnd()}…` : text
}

/** A stored `turns` value as turns, tolerating anything that is not one. */
export function parseTurns(raw: unknown): AskTurn[] {
  if (!Array.isArray(raw)) return []
  const turns: AskTurn[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue
    const record = entry as Record<string, unknown>
    const question = typeof record.question === "string" ? collapse(record.question).slice(0, MAX_QUESTION) : ""
    const answer = typeof record.answer === "string" ? record.answer.slice(0, MAX_ANSWER) : ""
    if (!question || !answer) continue
    const askedAt = typeof record.askedAt === "string" && !Number.isNaN(Date.parse(record.askedAt)) ? record.askedAt : new Date(0).toISOString()
    turns.push({ question, answer, askedAt })
  }
  return turns
}

/** The thread with one more exchange at the end, oldest turns dropped once it is long. */
export function appendTurn(turns: readonly AskTurn[], turn: AskTurn): AskTurn[] {
  const next = [...turns, { question: collapse(turn.question).slice(0, MAX_QUESTION), answer: turn.answer.slice(0, MAX_ANSWER), askedAt: turn.askedAt }]
  return next.length > CONVERSATION_TURNS_KEPT ? next.slice(next.length - CONVERSATION_TURNS_KEPT) : next
}

/** What the model is told of the thread so far: the last few turns, oldest first. */
export function historyTurns(turns: readonly AskTurn[], limit = CONVERSATION_HISTORY_TURNS): Array<{ question: string; answer: string }> {
  return turns.slice(-limit).map((turn) => ({ question: turn.question, answer: turn.answer }))
}

/** The instant older rows are deleted from, as the sweep's filter reads it. */
export function retentionCutoff(now: Date): string {
  return new Date(now.getTime() - CONVERSATION_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

/** Whether a conversation was last used today (WIB): the one the panel resumes on open. */
export function isFromToday(iso: string, now: Date): boolean {
  const when = Date.parse(iso)
  if (Number.isNaN(when)) return false
  return wibDayOf(new Date(when)) === wibDayOf(now)
}

/**
 * When a conversation was last used, as a list row says it: the clock for
 * today, the word for yesterday, the date before that. A row in a history
 * list answers "which one was that" faster with a relative date than with a
 * full timestamp.
 */
export function conversationDateLabel(iso: string, now: Date): string {
  const when = Date.parse(iso)
  if (Number.isNaN(when)) return ""
  const date = new Date(when)
  const day = wibDayOf(date)
  const today = wibDayOf(now)
  if (day === today) {
    const clock = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(date)
    return `Hari ini ${clock}`
  }
  const yesterday = new Date(`${today}T00:00:00+07:00`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  if (day === wibDayOf(yesterday)) return "Kemarin"
  const sameYear = day.slice(0, 4) === today.slice(0, 4)
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) }).format(date)
}

/** "3 pertanyaan": what a row says it holds. */
export function conversationTurnCountLabel(count: number): string {
  return `${count} pertanyaan`
}
