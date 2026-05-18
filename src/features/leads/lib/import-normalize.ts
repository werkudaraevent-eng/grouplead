/**
 * Import Value Normalization
 *
 * Helpers shared by `importLeadsAction` and `importHistoricalLeadsAction`
 * to coerce/normalize raw spreadsheet values into the shape our DB expects.
 *
 * Design:
 *   - Pure functions, no DB calls. Caller pre-fetches `master_options` once
 *     and passes the lookup map in.
 *   - Soft failures: when an exact taxonomic match isn't found we attempt a
 *     fuzzy match. If still no luck, we keep the raw value and surface a
 *     warning instead of throwing — one typo shouldn't kill an entire row.
 */

import { excelSerialToISO } from "@/utils/excel-date"

/**
 * Convert any reasonable date-ish input (ISO string, JS-parseable string,
 * Excel serial number, Date object) to ISO `YYYY-MM-DD`. Returns null if
 * nothing valid can be derived.
 *
 * Strict year bound: 1900–9999. Postgres TIMESTAMPTZ chokes on the `+`
 * prefix that `Date.toISOString()` emits for years outside that range
 * (e.g. "+013275-01-01" gets misread as a timezone offset).
 */
export function coerceDateToISO(input: unknown): string | null {
    if (input === null || input === undefined || input === "") return null

    let d: Date
    if (input instanceof Date) {
        if (isNaN(input.getTime())) return null
        d = input
    } else {
        const str = String(input).trim()
        if (!str) return null

        // Reject 4-digit year literals ("2026", "1999") so they don't become
        // Jan 1 of that year. The smart-date-parser handles year-only inputs
        // separately; here we want a strict single-day date or null.
        if (/^(?:19|20)\d{2}$/.test(str)) return null

        // Try Excel serial first — pure-numeric strings can be ambiguous, and
        // excelSerialToISO already rejects 4-digit year literals so it's safe.
        const serial = excelSerialToISO(str)
        if (serial) return serial

        // Fall back to native Date parsing (ISO strings, "21 Dec 2025", etc.).
        d = new Date(str)
        if (isNaN(d.getTime())) return null
    }

    const year = d.getFullYear()
    if (year < 1900 || year > 9999) return null

    // Manual format avoids the `+0YYYYY-MM-DD` extended-ISO output that
    // toISOString uses for years outside 0001–9999.
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${year}-${mm}-${dd}`
}

/**
 * Normalize a taxonomic value (Category, Grade Lead, Stream Type, ...)
 * against the master_options table. Tries:
 *   1. Trim + lowercase exact match
 *   2. Whitespace-collapsed match
 *   3. Substring/fuzzy match (≥ 0.85 similarity)
 *
 * Returns:
 *   - `{ value: <db-canonical>, matched: "exact" | "fuzzy" | "raw", warning? }`
 */
export interface TaxonomicMatchResult {
    value: string
    matched: "exact" | "fuzzy" | "raw"
    warning?: string
}

export function normalizeTaxonomicValue(
    fieldKey: string,
    rawValue: string,
    optionMap: Map<string, string>,
): TaxonomicMatchResult {
    const cleaned = rawValue.trim()
    if (!cleaned) return { value: cleaned, matched: "exact" }

    // Tier 1: exact (case-insensitive) match.
    const exactKey = `${fieldKey}|${cleaned.toLowerCase()}`
    const exact = optionMap.get(exactKey)
    if (exact) return { value: exact, matched: "exact" }

    // Tier 2: collapse internal whitespace and try again.
    const collapsed = cleaned.replace(/\s+/g, " ").trim().toLowerCase()
    const collapsedMatch = optionMap.get(`${fieldKey}|${collapsed}`)
    if (collapsedMatch) return { value: collapsedMatch, matched: "exact" }

    // Tier 3: fuzzy match against any option of the same field key.
    const candidates: string[] = []
    for (const [key, val] of optionMap) {
        if (key.startsWith(`${fieldKey}|`)) candidates.push(val)
    }

    if (candidates.length > 0) {
        let best: { val: string; score: number } | null = null
        for (const cand of candidates) {
            const score = diceBigram(collapsed, cand.toLowerCase().trim())
            if (!best || score > best.score) best = { val: cand, score }
        }
        if (best && best.score >= 0.7) {
            return {
                value: best.val,
                matched: "fuzzy",
                warning: `Auto-corrected "${cleaned}" → "${best.val}" (${Math.round(best.score * 100)}% match)`,
            }
        }
    }

    // Tier 4: keep raw value with a warning. Better than failing the row.
    return {
        value: cleaned,
        matched: "raw",
        warning: `"${cleaned}" doesn't match any ${fieldKey.replace("_", " ")} option — kept as-is`,
    }
}

/**
 * Dice coefficient on character bigrams (0..1).
 */
function diceBigram(a: string, b: string): number {
    if (a === b) return 1
    if (a.length < 2 || b.length < 2) return 0
    const bigrams = (s: string): Map<string, number> => {
        const m = new Map<string, number>()
        for (let i = 0; i < s.length - 1; i++) {
            const bg = s.slice(i, i + 2)
            m.set(bg, (m.get(bg) ?? 0) + 1)
        }
        return m
    }
    const aBg = bigrams(a)
    const bBg = bigrams(b)
    let intersect = 0
    for (const [bg, count] of aBg) {
        const other = bBg.get(bg) ?? 0
        intersect += Math.min(count, other)
    }
    const total = (a.length - 1) + (b.length - 1)
    return total === 0 ? 0 : (2 * intersect) / total
}

/**
 * Coerce numeric-ish string to number, stripping commas/dots/whitespace
 * thousand separators commonly found in Indonesian spreadsheets
 * ("3.090.000" or "3,090,000" → 3090000).
 */
export function coerceNumber(input: unknown): number | null {
    if (input === null || input === undefined || input === "") return null
    if (typeof input === "number") return Number.isFinite(input) ? input : null
    const cleaned = String(input).replace(/[,.\s]/g, "")
    if (!cleaned) return null
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : null
}
