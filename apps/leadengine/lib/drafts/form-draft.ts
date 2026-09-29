/**
 * What a form keeps in this browser while it is being filled in, as rules
 * that run without a DOM so they can be tested.
 *
 * A draft is the form's answers by field key, stored in localStorage under
 * one key per person, form and record, with the time it was written. It
 * exists so that a reload (after a deploy, a crash, a closed tab) never
 * costs what was typed; it is not a second copy of anything the server
 * already holds, and it never holds a file.
 *
 * The answers are stored by field key, never by position or by label, so
 * a form the admin reorders or relabels still takes its draft back: a key
 * the form no longer has is ignored, a key the draft lacks starts empty.
 *
 * Kept in step with `apps/sales-mission/lib/drafts/form-draft.ts`.
 */

export const FORM_DRAFT_PREFIX = "le-draft:v1:"
/** A draft older than this is dropped rather than offered back. */
export const FORM_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60_000
/** Typing is written this long after the last keystroke. */
export const FORM_DRAFT_SAVE_DELAY_MS = 400
/** A clock that jumped this far ahead is not trusted either. */
const FUTURE_SLACK_MS = 24 * 60 * 60_000

const part = (value: string) => encodeURIComponent(value.trim())

/**
 * The storage key: whose draft, which form, which record ("new" for one
 * not yet saved). Null without an owner, so no draft is ever written for a
 * person nobody knows, nor read back to someone else on a shared device.
 */
export function formDraftKey(owner: string | null | undefined, form: string, record: string): string | null {
  if (!owner || !owner.trim() || !form.trim() || !record.trim()) return null
  return `${FORM_DRAFT_PREFIX}${part(owner)}:${part(form)}:${part(record)}`
}

interface StoredDraft<T> {
  v: 1
  savedAt: number
  values: T
}

export function serializeFormDraft<T>(values: T, savedAt: number): string {
  const stored: StoredDraft<T> = { v: 1, savedAt, values }
  return JSON.stringify(stored)
}

/** The draft in a stored string, or null when it is missing, malformed, from another format, or expired. */
export function parseFormDraft<T = unknown>(raw: string | null | undefined, now: number, maxAgeMs = FORM_DRAFT_MAX_AGE_MS): { values: T; savedAt: number } | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object") return null
  const { v, savedAt, values } = parsed as Partial<StoredDraft<T>>
  if (v !== 1 || typeof savedAt !== "number" || !Number.isFinite(savedAt)) return null
  if (values === undefined || values === null || typeof values !== "object") return null
  if (now - savedAt > maxAgeMs || savedAt - now > FUTURE_SLACK_MS) return null
  return { values: values as T, savedAt }
}

/** The keys of this app's drafts that should go: expired or unreadable. Other keys are never touched. */
export function staleFormDraftKeys(entries: Iterable<[string, string | null]>, now: number, maxAgeMs = FORM_DRAFT_MAX_AGE_MS): string[] {
  const stale: string[] = []
  for (const [key, raw] of entries) {
    if (!key.startsWith(FORM_DRAFT_PREFIX)) continue
    if (!parseFormDraft(raw, now, maxAgeMs)) stale.push(key)
  }
  return stale
}

// ─── A posting form's answers ────────────────────────────────────────

/** A posting form's answers by input name: a name posted twice (a checklist, a list of people) is a list. */
export type FormValues = Record<string, string | string[]>

/**
 * A form's entries as a draft. Files are dropped (a draft never holds
 * one), and so are the fields React adds to a form it can post without
 * JavaScript (`$ACTION_…`), which name the build rather than an answer.
 */
export function formValuesFromEntries(entries: Iterable<[string, unknown]>, skip: (name: string) => boolean = () => false): FormValues {
  const values: FormValues = {}
  for (const [name, value] of entries) {
    if (typeof value !== "string" || name.startsWith("$ACTION") || skip(name)) continue
    const existing = values[name]
    if (existing === undefined) values[name] = value
    else values[name] = Array.isArray(existing) ? [...existing, value] : [existing, value]
  }
  return values
}

function asList(value: string | string[] | undefined): string[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/** Whether two sets of answers say the same thing (key order does not count, list order does). */
export function sameFormValues(a: FormValues, b: FormValues): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    const left = asList(a[key])
    const right = asList(b[key])
    if (left.length !== right.length || left.some((item, index) => item !== right[index])) return false
  }
  return true
}

/** One answer as text; undefined when the draft has no such field. */
export function draftText(values: FormValues, name: string): string | undefined {
  const value = values[name]
  if (value === undefined) return undefined
  return Array.isArray(value) ? (value[0] ?? "") : value
}

/** A field posted as a list (people, a checklist): empty when the draft has none, since an empty list posts nothing. */
export function draftList(values: FormValues, name: string): string[] {
  return asList(values[name])
}

/**
 * The answers to the admin's own fields, by reporting key, from the inputs
 * named `<prefix><key>`. A checkbox answers true when it posted "true";
 * an unticked one posts nothing, which reads as false.
 */
export function customAnswersFromDraft(values: FormValues, fields: ReadonlyArray<{ reportingKey: string; fieldType: string }>, prefix = "custom__"): Record<string, unknown> {
  const answers: Record<string, unknown> = {}
  for (const field of fields) {
    const name = `${prefix}${field.reportingKey}`
    if (field.fieldType === "BOOLEAN") answers[field.reportingKey] = draftText(values, name) === "true"
    else if (field.fieldType === "MULTI_SELECT") answers[field.reportingKey] = draftList(values, name)
    else answers[field.reportingKey] = draftText(values, name) ?? ""
  }
  return answers
}

// ─── A form held in state ────────────────────────────────────────────

function sameShape(base: unknown, value: unknown): boolean {
  if (base === null) return value === null || typeof value !== "object"
  if (Array.isArray(base)) return Array.isArray(value)
  if (typeof base === "object") return value !== null && typeof value === "object" && !Array.isArray(value)
  return typeof value === typeof base
}

/**
 * A stored draft laid over a fresh form, key by key: only the keys the form
 * has now are taken, and only when the stored value has the form's shape
 * for that key (a list for a list, a word for a word; a key that starts
 * empty takes a word, a number or a flag). Everything else keeps the fresh
 * value, so a draft from an older form can never put junk in a field.
 */
export function mergeDraftValues<T extends object>(base: T, stored: unknown): T {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return base
  const source = stored as Record<string, unknown>
  const fresh = base as Record<string, unknown>
  const merged: Record<string, unknown> = { ...fresh }
  for (const key of Object.keys(fresh)) {
    if (!(key in source)) continue
    const value = source[key]
    if (value === undefined || !sameShape(fresh[key], value)) continue
    merged[key] = value
  }
  return merged as T
}
