/**
 * Excel Serial Date Conversion
 *
 * Excel stores dates as serial numbers — days since 1900-01-00 (with the
 * infamous Feb 29 1900 leap year bug). Sheets exported from Excel often
 * contain raw numbers like 46012 instead of formatted strings.
 *
 *   46012     = December 21, 2025
 *   46023     = January 1, 2026
 *   46012.375 = December 21, 2025 09:00 (fractional = time of day)
 *
 * For serials >= 61 (1900-03-01 onward), the formula is:
 *   js_ms = (serial - 25569) * 86400_000
 * where 25569 = days from 1900-01-00 (Excel epoch with the leap bug) to
 * the Unix epoch 1970-01-01.
 */

// Lower bound chosen to reject 4-digit year literals like 2025/2026 from
// being interpreted as Excel serials. Serial 30000 ≈ 1982-03-15, which is
// older than any plausible CRM data we would import.
const MIN_SERIAL = 30_000
const MAX_SERIAL = 80_000 // ~2119

/**
 * Convert an Excel serial number to ISO date string (YYYY-MM-DD).
 * Returns null for invalid input or out-of-range values.
 *
 * @example
 *   excelSerialToISO(46012)       // "2025-12-21"
 *   excelSerialToISO(46012.375)   // "2025-12-21" (time portion ignored)
 *   excelSerialToISO("46012")     // "2025-12-21"
 *   excelSerialToISO("2026")      // null (looks like a year, not a serial)
 */
export function excelSerialToISO(input: unknown): string | null {
    let serial: number
    if (typeof input === "number") {
        serial = input
    } else if (typeof input === "string") {
        const trimmed = input.trim()
        if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
        // Reject 4-digit year literals (e.g. "2025", "2026", "1999") so
        // that columns containing only the year don't get misread as serials.
        if (/^(?:19|20)\d{2}$/.test(trimmed)) return null
        serial = parseFloat(trimmed)
    } else {
        return null
    }

    if (!Number.isFinite(serial) || serial < MIN_SERIAL || serial > MAX_SERIAL) return null

    // Use UTC math anchored to the Unix epoch via the standard 25569 offset.
    // floor(serial) drops the time-of-day portion.
    const wholeDays = Math.floor(serial)
    const ms = (wholeDays - 25_569) * 86_400_000
    const d = new Date(ms)
    if (isNaN(d.getTime())) return null

    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
    const dd = String(d.getUTCDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
}

/**
 * Detect whether a value looks like an Excel serial date (vs. a year, an ID,
 * or a regular number).
 */
export function looksLikeExcelSerial(input: unknown): boolean {
    return excelSerialToISO(input) !== null
}
