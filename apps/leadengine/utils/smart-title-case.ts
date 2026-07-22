/**
 * Smart Title Case — converts ALL CAPS text to proper Title Case
 * while intelligently preserving abbreviations, acronyms, and special tokens.
 *
 * Rules:
 * 1. Words ≤ 3 chars that are ALL CAPS → keep as-is (abbreviations: PT, CV, UK, WG, etc.)
 * 2. Words containing digits → keep as-is (3D2N, 2026, etc.)
 * 3. Known abbreviations (any length) → keep as-is (UGM, ITB, MICE, etc.)
 * 4. Common prepositions/conjunctions → lowercase (except when first word)
 * 5. Everything else → Title Case
 * 6. First word always starts with a capital letter
 */

// Known abbreviations & acronyms that should ALWAYS stay uppercase
const KNOWN_ABBREVIATIONS = new Set([
    // Indonesian
    "PT", "CV", "TB", "UD", "PD", "PO", "TBK", "SH", "SE", "MM", "MBA",
    // Universities
    "UGM", "ITB", "UI", "UB", "ITS", "UNS", "UPI", "IPB", "USU", "UNDIP",
    "UNAIR", "UNJ", "UIN", "IAIN", "STIE",
    // Event / Industry
    "MICE", "DMC", "PCO", "OB", "MC", "VIP", "VVIP", "LED", "PA", "LCD",
    "DJ", "AV", "AC", "TV", "USB", "HDMI", "SOP",
    // Business
    "CEO", "CFO", "CTO", "COO", "HR", "IT", "GA", "PR", "GM", "AGM",
    "CSR", "KPI", "OKR", "MOU", "SPK", "PO", "SO", "DO", "TOR",
    "RFP", "RFQ", "LOI", "BQ", "RAB", "LPJ",
    // Geography / Orgs
    "RI", "USA", "UK", "UAE", "EU", "UN", "ASEAN", "APEC", "IMF",
    "DKI", "DIY", "NTB", "NTT", "DI",
    // Subsidiary codes
    "WNW", "WNS", "MRP", "TEE", "WNN",
    // Common misc
    "ATM", "SMS", "BBQ", "AC", "DC", "BRT", "LRT", "MRT", "KRL",
    "BUMN", "BUMD", "OPD", "PNS", "ASN", "TNI", "POLRI",
    "BSI", "BCA", "BRI", "BNI", "BTN", "BJB", "MANDIRI",
    "PLN", "PERTAMINA", "TELKOM",
])

// Prepositions / conjunctions → lowercase (unless first word)
const LOWERCASE_WORDS = new Set([
    "dan", "atau", "di", "ke", "dari", "yang", "untuk", "pada", "oleh",
    "dengan", "serta", "atas", "bagi", "ini", "itu", "juga",
    "and", "or", "of", "in", "at", "to", "for", "with", "by", "the",
    "a", "an", "on", "off", "from", "but", "nor", "yet", "so", "vs", "via",
])

/**
 * Determines if a word looks like an abbreviation or special token.
 */
function isAbbreviation(word: string): boolean {
    // Check known list (case-insensitive)
    if (KNOWN_ABBREVIATIONS.has(word.toUpperCase())) return true

    // If it's a known conjunction, it is NOT an acronym
    if (LOWERCASE_WORDS.has(word.toLowerCase())) return false

    // Contains digits → keep as-is (e.g. "3D2N", "22JAN")
    if (/\d/.test(word)) return true

    // All uppercase AND ≤ 3 characters → likely abbreviation
    if (word === word.toUpperCase() && word.length <= 3 && /^[A-Z]+$/.test(word)) return true

    // All uppercase AND contains no vowels → likely abbreviation (e.g. "PCS", "QTY")
    if (word === word.toUpperCase() && /^[A-Z]+$/.test(word) && !/[AEIOU]/.test(word)) return true

    return false
}

/**
 * Converts a single word to Title Case.
 */
function toTitleWord(word: string): string {
    if (word.length === 0) return word
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

/**
 * Main smart title case function.
 * Converts ALL CAPS (or any casing) to proper Title Case with smart abbreviation handling.
 */
export function smartTitleCase(text: string | null | undefined): string | null {
    if (!text || typeof text !== "string") return text ?? null
    const trimmed = text.trim()
    if (!trimmed) return null

    // If the text is NOT mostly uppercase, return as-is (user already formatted it)
    const upperCount = (trimmed.match(/[A-Z]/g) || []).length
    const lowerCount = (trimmed.match(/[a-z]/g) || []).length
    const totalLetters = upperCount + lowerCount
    if (totalLetters > 0 && upperCount / totalLetters < 0.7) {
        return trimmed // Already mixed case, don't touch it
    }

    // Split on spaces (preserve multiple spaces)
    const words = trimmed.split(/(\s+)/)

    const result = words.map((segment, index) => {
        // Preserve whitespace segments
        if (/^\s+$/.test(segment)) return segment

        // Handle hyphenated words (e.g. "SEMI-FORMAL")
        if (segment.includes("-")) {
            return segment
                .split("-")
                .map((part, partIdx) => {
                    if (isAbbreviation(part)) return part.toUpperCase()
                    // Lowercase words in hyphenated compound (except first part of first word)
                    if (index === 0 && partIdx === 0) return toTitleWord(part)
                    if (LOWERCASE_WORDS.has(part.toLowerCase())) return part.toLowerCase()
                    return toTitleWord(part)
                })
                .join("-")
        }

        // Symbols & punctuation — keep as-is
        if (/^[^a-zA-Z0-9]+$/.test(segment)) return segment

        // Strip any trailing punctuation for checking, reattach later
        const punctuationMatch = segment.match(/^([a-zA-Z0-9]+)([^a-zA-Z0-9]*)$/)
        const core = punctuationMatch ? punctuationMatch[1] : segment
        const trailing = punctuationMatch ? punctuationMatch[2] : ""

        // Check abbreviation
        if (isAbbreviation(core)) return core.toUpperCase() + trailing

        // Find the actual word index (ignoring whitespace segments) for "first word" check
        const isFirstWord = words.slice(0, index).every((s) => /^\s*$/.test(s))

        // Lowercase words (prepositions) — but not if first word
        if (!isFirstWord && LOWERCASE_WORDS.has(core.toLowerCase())) {
            return core.toLowerCase() + trailing
        }

        return toTitleWord(core) + trailing
    })

    return result.join("")
}

/**
 * Apply smart title case to specific fields in an import row.
 * Only transforms text fields that commonly contain ALL CAPS data.
 */
const SMART_CASE_FIELDS = new Set([
    "project_name",
    "client_company_name",
    "contact_name",
    "business_purpose",
    "description",
    "general_brief",
    "remark",
    "area",
    "destinations",
    "stream_type",
    "main_stream",
])

export function smartCaseRow(row: Record<string, unknown>): Record<string, unknown> {
    const result = { ...row }
    for (const key of SMART_CASE_FIELDS) {
        if (key in result && typeof result[key] === "string") {
            result[key] = smartTitleCase(result[key] as string)
        }
    }
    return result
}
