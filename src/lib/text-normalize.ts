/**
 * Text normalization helpers for user-input string fields on Companies
 * and Contacts (and any other entity that stores human-typed names).
 *
 * Two layers:
 *   1. `normalizeWhitespace`  — minimum hygiene: trim + collapse runs of
 *                                whitespace into a single space. Always
 *                                safe to apply server-side.
 *   2. `suggestTitleCase`     — opt-in suggestion for fields that look
 *                                ALL-CAPS-y. Reuses `smartTitleCase` so
 *                                Indonesian acronyms (PT, Tbk, BCA, …)
 *                                stay uppercase. Returns `null` when
 *                                no suggestion is needed (already
 *                                well-cased, too short, or empty).
 *
 * The dashboard convention is to NORMALIZE WHITESPACE silently and
 * SUGGEST title-case (never auto-rewrite) — see
 * `docs/text-input-conventions.md` for the rationale.
 */

import { smartTitleCase } from "@/utils/smart-title-case"

/**
 * Trim and collapse internal whitespace runs to a single space.
 * Returns `null` for empty/whitespace-only input so callers can store
 * NULL instead of an empty string.
 */
export function normalizeWhitespace(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null
    const trimmed = value.replace(/\s+/g, " ").trim()
    return trimmed.length > 0 ? trimmed : null
}

/**
 * Apply `normalizeWhitespace` to every string-valued key in a payload.
 * Keys whose value is not a string (numbers, booleans, arrays of
 * non-strings, nested objects) are passed through untouched. String
 * arrays are normalized element-by-element with empty entries dropped.
 *
 * This is the single function that server actions should call before
 * inserting/updating company / contact rows.
 */
export function normalizeStringFields<T extends Record<string, unknown>>(payload: T): T {
    const result: Record<string, unknown> = { ...payload }
    for (const [key, val] of Object.entries(payload)) {
        if (typeof val === "string") {
            result[key] = normalizeWhitespace(val)
        } else if (Array.isArray(val) && val.every(v => typeof v === "string" || v === null)) {
            const cleaned = (val as Array<string | null>)
                .map(v => normalizeWhitespace(v))
                .filter((v): v is string => v !== null)
            result[key] = cleaned
        }
    }
    return result as T
}

/**
 * Calculate the share of uppercase ASCII letters relative to all letters.
 * Returns 0 for non-letter input. Used as a heuristic to decide whether
 * a string deserves a title-case suggestion.
 */
function uppercaseRatio(value: string): number {
    const letters = value.match(/[A-Za-z]/g) ?? []
    if (letters.length === 0) return 0
    const upper = letters.filter(l => l >= "A" && l <= "Z").length
    return upper / letters.length
}

/**
 * Returns a smart-title-cased version of the input ONLY when it looks
 * like the user typed in ALL CAPS (or near-all caps) and the suggested
 * version is actually different from the original. Otherwise returns
 * `null` — the caller should treat that as "no suggestion".
 *
 * The threshold is 70% uppercase letters AND length >= 4 to avoid
 * suggesting changes for short codes / acronyms ("BCA", "DKI", …).
 */
export function suggestTitleCase(value: string | null | undefined): string | null {
    const cleaned = normalizeWhitespace(value)
    if (!cleaned || cleaned.length < 4) return null
    if (uppercaseRatio(cleaned) < 0.7) return null
    const suggested = smartTitleCase(cleaned)
    if (!suggested) return null
    if (suggested === cleaned) return null
    return suggested
}
