/**
 * Smart Event Date Parser — Enterprise-Grade Natural Language Date Parsing
 * 
 * Converts human-friendly date expressions into ISO date arrays (YYYY-MM-DD).
 * 
 * Supported formats:
 * ─────────────────────────────────────────────────────────────────
 *  Input                          │ Output
 * ─────────────────────────────────────────────────────────────────
 *  "3-5 Jan 2026"                 │ ["2026-01-03","2026-01-04","2026-01-05"]
 *  "21 - 24 Jan 26"              │ 2-digit year + spaces around dash
 *  "1- 5 Feb 26"                 │ Inconsistent spacing
 *  "3,5 Jan 2026"                │ Individual dates (skip)
 *  "3-5, 8 Jan 2026"            │ Mixed range + individual
 *  "19 Feb - 18 Mar 26"         │ Cross-month range
 *  "28 Feb - 1 Mar 26"          │ Cross-month range
 *  "3-5 Jan, 2-3 Feb 2026"      │ Multi-month blocks
 *  "3 Januari 2026"             │ Indonesian month names
 *  "21 Dec 2025"                │ Single date
 *  "4 Feb 2026"                 │ Single date
 *  "2026-01-03, 2026-01-05"     │ ISO format passthrough
 * ─────────────────────────────────────────────────────────────────
 */

const MONTH_MAP: Record<string, number> = {
    // English — full & abbreviated
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
    // Indonesian
    januari: 0,
    februari: 1,
    maret: 2,
    // april already covered above
    mei: 4,
    juni: 5,
    juli: 6,
    agustus: 7,
    // september already covered
    oktober: 9,
    // november already covered
    desember: 11,
    // Indonesian abbreviated
    agt: 7,
    okt: 9,
    des: 11,
}

/** Pad a number to 2 digits */
function pad2(n: number): string {
    return String(n).padStart(2, "0")
}

/** Format a date as YYYY-MM-DD */
function toISO(year: number, month: number, day: number): string {
    return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

/** Validate a date is real (e.g., Feb 30 is not valid) */
function isValidDate(year: number, month: number, day: number): boolean {
    const d = new Date(year, month, day)
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
}

/** Resolve 2-digit or 4-digit year to full year */
function resolveYear(yearStr: string): number {
    const num = parseInt(yearStr)
    if (num < 100) return 2000 + num  // 26 → 2026, 25 → 2025
    return num
}

/** Try to find a month name, returning the 0-indexed month number */
function findMonth(str: string): number | null {
    const lower = str.toLowerCase().trim()
    for (const [name, idx] of Object.entries(MONTH_MAP)) {
        if (lower === name) return idx
    }
    return null
}

/**
 * Generate all dates between two dates (inclusive).
 */
function generateDateRange(startYear: number, startMonth: number, startDay: number,
    endYear: number, endMonth: number, endDay: number): string[] {
    const dates: string[] = []
    const start = new Date(startYear, startMonth, startDay)
    const end = new Date(endYear, endMonth, endDay)

    // Safety: max 366 days range
    if (end < start || (end.getTime() - start.getTime()) > 366 * 86400000) return []

    const current = new Date(start)
    while (current <= end) {
        dates.push(toISO(current.getFullYear(), current.getMonth(), current.getDate()))
        current.setDate(current.getDate() + 1)
    }
    return dates
}

/**
 * Expand day segment expressions like "3-5" or "3" or "3-5, 8, 10-12"
 * into an array of individual day numbers.
 */
function expandDaySegments(daysPart: string): number[] {
    const days: number[] = []
    const segments = daysPart.split(/,/).map(s => s.trim()).filter(Boolean)

    for (const seg of segments) {
        // Check for range: "3-5" or "3–5" or "3 - 5" or "1- 5"
        const rangeMatch = seg.match(/^(\d+)\s*[-–—]\s*(\d+)$/)
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1])
            const end = parseInt(rangeMatch[2])
            if (start <= end && end <= 31) {
                for (let d = start; d <= end; d++) days.push(d)
            }
        } else {
            const num = parseInt(seg)
            if (!isNaN(num) && num >= 1 && num <= 31) days.push(num)
        }
    }

    return [...new Set(days)].sort((a, b) => a - b)
}

/**
 * Main smart parser — converts a natural language date string into ISO date array.
 */
export function parseSmartEventDates(input: string): string[] {
    if (!input || !input.trim()) return []

    const trimmed = input.trim()

    // ═══ Strategy 1: Pure ISO dates (2026-01-03, 2026-01-05) ═══
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed
            .split(/[,;]+/)
            .map(s => s.trim())
            .filter(s => {
                if (!s) return false
                const d = new Date(s)
                return !isNaN(d.getTime())
            })
            .map(s => {
                const d = new Date(s)
                return toISO(d.getFullYear(), d.getMonth(), d.getDate())
            })
            .sort()
    }

    // ═══ Strategy 2: Cross-month range ═══
    // "19 Feb - 18 Mar 26" or "28 Feb - 1 Mar 2026"
    // Pattern: DD Month - DD Month YY(YY)
    const crossMonthMatch = trimmed.match(
        /^(\d{1,2})\s+([a-zA-Z]+)\s*[-–—]\s*(\d{1,2})\s+([a-zA-Z]+)\s+(\d{2,4})$/
    )
    if (crossMonthMatch) {
        const startDay = parseInt(crossMonthMatch[1])
        const startMonth = findMonth(crossMonthMatch[2])
        const endDay = parseInt(crossMonthMatch[3])
        const endMonth = findMonth(crossMonthMatch[4])
        const year = resolveYear(crossMonthMatch[5])

        if (startMonth !== null && endMonth !== null) {
            const dates = generateDateRange(year, startMonth, startDay, year, endMonth, endDay)
            if (dates.length > 0) return dates
        }
    }

    // ═══ Strategy 3: Same-month range ═══
    // "21 - 24 Jan 26" or "3-5 Jan 2026" or "1- 5 Feb 26"
    // Pattern: DD - DD Month YY(YY)
    const sameMonthRangeMatch = trimmed.match(
        /^(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+([a-zA-Z]+)\s+(\d{2,4})$/
    )
    if (sameMonthRangeMatch) {
        const startDay = parseInt(sameMonthRangeMatch[1])
        const endDay = parseInt(sameMonthRangeMatch[2])
        const month = findMonth(sameMonthRangeMatch[3])
        const year = resolveYear(sameMonthRangeMatch[4])

        if (month !== null) {
            const dates = generateDateRange(year, month, startDay, year, month, endDay)
            if (dates.length > 0) return dates
        }
    }

    // ═══ Strategy 4: Single date ═══
    // "4 Feb 2026" or "21 Dec 2025" or "18 Feb 26"
    // Pattern: DD Month YY(YY)
    const singleDateMatch = trimmed.match(
        /^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{2,4})$/
    )
    if (singleDateMatch) {
        const day = parseInt(singleDateMatch[1])
        const month = findMonth(singleDateMatch[2])
        const year = resolveYear(singleDateMatch[3])

        if (month !== null && isValidDate(year, month, day)) {
            return [toISO(year, month, day)]
        }
    }

    // ═══ Strategy 5: Compact multi-date format ═══
    // "3,5,8 Jan 2026" or "3-5, 8 Jan 2026" or "3-5 Jan, 2-3 Feb 2026"
    // Extract year from end (2 or 4 digit)
    const yearMatch = trimmed.match(/(\d{2,4})\s*$/)
    if (yearMatch) {
        const year = resolveYear(yearMatch[1])
        const withoutYear = trimmed.slice(0, yearMatch.index).trim()

        // Split into month blocks: "3-5 Jan, 2-3 Feb" → ["3-5 Jan", "2-3 Feb"]
        const monthBlockRegex = /([\d,\s\-–—]+)\s+([a-zA-Z]+)/g
        const blocks: Array<{ days: number[]; month: number }> = []
        let blockMatch

        while ((blockMatch = monthBlockRegex.exec(withoutYear)) !== null) {
            const daysPart = blockMatch[1].trim()
            const monthStr = blockMatch[2]
            const monthIdx = findMonth(monthStr)

            if (monthIdx !== null) {
                const days = expandDaySegments(daysPart)
                if (days.length > 0) {
                    blocks.push({ days, month: monthIdx })
                }
            }
        }

        if (blocks.length > 0) {
            const dates: string[] = []
            for (const block of blocks) {
                for (const day of block.days) {
                    if (isValidDate(year, block.month, day)) {
                        dates.push(toISO(year, block.month, day))
                    }
                }
            }
            if (dates.length > 0) {
                return [...new Set(dates)].sort()
            }
        }
    }

    // ═══ Strategy 6: Full date strings separated by commas/semicolons ═══
    // "3 Jan 2026, 5 Jan 2026" or "January 3 2026; February 5 2026"
    const parts = trimmed.split(/[;]+/).flatMap(segment => {
        return segment.split(/,\s*(?=\d)/)
    }).map(s => s.trim()).filter(Boolean)

    const results: string[] = []
    for (const part of parts) {
        const d = new Date(part)
        if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
            results.push(toISO(d.getFullYear(), d.getMonth(), d.getDate()))
        }
    }

    if (results.length > 0) {
        return [...new Set(results)].sort()
    }

    return []
}
