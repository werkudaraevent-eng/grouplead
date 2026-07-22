/**
 * Phone number normalization & formatting.
 *
 * Source of truth = E.164 (`+628112836676`). Stored in DB.
 * Display = pretty national format (e.g. `+62 811-2836-676`).
 *
 * Default country = Indonesia. Foreign numbers stay in their own
 * country code as long as they include `+` or a recognised country
 * prefix.
 *
 * Why a single util:
 *   • Dedup, search, and `tel:` links all need a stable canonical form.
 *   • Hand-rolled regex breaks on real Indonesian quirks (021 area code
 *     vs 0811 mobile prefix, leading 62 vs +62, etc.). libphonenumber-js
 *     ships proper metadata.
 *
 * Public surface:
 *   • normalizePhoneToE164(input, defaultCountry?) → string | null
 *   • formatPhoneDisplay(value)                    → string
 *   • isValidPhone(input, defaultCountry?)         → boolean
 *   • phoneFormatHint(input, defaultCountry?)      → "ok" | "invalid" | "empty"
 */

import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js"

export const DEFAULT_PHONE_COUNTRY: CountryCode = "ID"

/**
 * Normalize any user-typed phone string to canonical E.164.
 *
 * Returns `null` when:
 *   • input is empty / whitespace only
 *   • input is unparseable or fails country-aware validation
 *
 * Examples (defaultCountry = "ID"):
 *   "0811-2836-676"     → "+628112836676"
 *   "8112836676"        → "+628112836676"  (assume ID mobile, prepend 0 internally)
 *   "62 811 2836 676"   → "+628112836676"
 *   "+62 811-2836-676"  → "+628112836676"
 *   "(021) 3192-4828"   → "+62213192824828" → actually "+62213192828" — depends on input length
 *   "+1 415 555 1234"   → "+14155551234"
 *   "123"               → null   (too short for any country)
 *   ""                  → null
 */
export function normalizePhoneToE164(
    input: string | null | undefined,
    defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string | null {
    if (input == null) return null
    const raw = String(input).trim()
    if (!raw) return null

    // Pre-clean: collapse whitespace and common separators that some
    // parsers handle inconsistently. Keep `+` for explicit international.
    const cleaned = raw.replace(/[^\d+]/g, "")
    if (!cleaned) return null

    // Heuristic for ID local numbers without leading 0:
    //   "8112836676" → assume mobile "08112836676" before parsing.
    //   Triggered only when:
    //     - default country is ID
    //     - no leading + (so user is not typing intl)
    //     - no leading 0
    //     - first digit is 8 (Indonesian mobile prefix range 8xx)
    //     - length 9–13 digits (typical mobile range)
    let candidate = cleaned
    if (
        defaultCountry === "ID" &&
        !candidate.startsWith("+") &&
        !candidate.startsWith("0") &&
        candidate.startsWith("8") &&
        candidate.length >= 9 &&
        candidate.length <= 13
    ) {
        candidate = "0" + candidate
    }

    // Bare "62…" (no plus) → upgrade to "+62…" so libphonenumber-js parses
    // as international rather than treating 62 as area code.
    if (
        defaultCountry === "ID" &&
        !candidate.startsWith("+") &&
        candidate.startsWith("62") &&
        candidate.length >= 11
    ) {
        candidate = "+" + candidate
    }

    try {
        const parsed = parsePhoneNumberFromString(candidate, defaultCountry)
        if (!parsed) return null
        if (!parsed.isValid()) return null
        return parsed.number // E.164 with leading +
    } catch {
        return null
    }
}

/**
 * Format an E.164 (or anything we can normalize) for human display.
 *
 * Rule:
 *   • If parseable → INTERNATIONAL format ("+62 811-2836-676").
 *   • If not → return the raw input unchanged so we never *lose* user
 *     data on display (legacy rows that didn't migrate cleanly still
 *     render).
 */
export function formatPhoneDisplay(
    value: string | null | undefined,
    defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
    if (!value) return ""
    const raw = String(value).trim()
    if (!raw) return ""
    try {
        const parsed = parsePhoneNumberFromString(raw, defaultCountry)
        if (parsed && parsed.isValid()) return parsed.formatInternational()
    } catch {
        /* fall through */
    }
    return raw
}

/**
 * True when input parses to a valid number for the given country (or
 * the country embedded in the international prefix).
 *
 * Empty / null counts as **valid** because phone is generally optional.
 * Use a separate "required" check upstream when needed.
 */
export function isValidPhone(
    input: string | null | undefined,
    defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): boolean {
    if (input == null) return true
    const raw = String(input).trim()
    if (!raw) return true
    return normalizePhoneToE164(raw, defaultCountry) !== null
}

/**
 * Lightweight status helper for inline form hints.
 */
export function phoneFormatStatus(
    input: string | null | undefined,
    defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): "ok" | "invalid" | "empty" {
    if (input == null) return "empty"
    const raw = String(input).trim()
    if (!raw) return "empty"
    return normalizePhoneToE164(raw, defaultCountry) ? "ok" : "invalid"
}
