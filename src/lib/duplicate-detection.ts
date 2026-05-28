/**
 * Duplicate detection for human-typed entity names (companies and
 * contacts). Soft-match — never blocks a save, only surfaces an inline
 * hint so the user can choose to use an existing record instead of
 * creating a duplicate.
 *
 * Strategy:
 *   1. Normalize the candidate (lowercase, collapse whitespace, strip
 *      common legal-form prefixes like "PT", "CV", "Tbk", "Inc.", etc.).
 *   2. Normalize every existing record the same way.
 *   3. Score each candidate vs. existing using a cheap similarity
 *      check that is conservative on purpose:
 *        - Exact normalized match → "exact"
 *        - One side fully contains the other → "contains"
 *        - Same first-3 normalized characters → "prefix"
 *      We deliberately skip Levenshtein / fuzzy distance: it produces
 *      noisy false-positives on Indonesian names ("Bank Central Asia"
 *      vs "Bank Central Asia Tbk" should match — handled by "contains"
 *      after prefix stripping).
 *   4. Return the top N candidates.
 *
 * This module is pure (no Supabase imports) so it is unit-testable.
 * The server action that calls it is responsible for fetching the
 * candidate list within the active company scope.
 */

const LEGAL_PREFIXES = [
    // Indonesian
    "pt", "cv", "ud", "pd", "po",
    // Suffix-style: detect via tokens, not as opening
    // (handled by tokenization)
    // International
    "inc", "inc.", "ltd", "ltd.", "llc", "llc.", "corp", "corp.",
    "co", "co.", "company", "limited", "gmbh", "ag", "sa", "se",
    "plc",
] as const

const LEGAL_SUFFIXES = [
    "tbk", "(tbk)", "(persero)", "persero", "tbk.",
    "inc", "inc.", "ltd", "ltd.", "llc", "llc.", "corp", "corp.",
    "co", "co.", "limited", "gmbh", "ag", "sa", "se", "plc",
] as const

const LEGAL_PREFIX_SET = new Set<string>(LEGAL_PREFIXES.map(s => s.toLowerCase()))
const LEGAL_SUFFIX_SET = new Set<string>(LEGAL_SUFFIXES.map(s => s.toLowerCase()))

/**
 * Lowercases, collapses whitespace, and strips legal-form prefixes
 * and suffixes ("PT", "Tbk", "Inc.") so two records that differ only
 * by their legal form match.
 *
 * Examples:
 *   "PT Bank Central Asia Tbk" → "bank central asia"
 *   "Bank Central Asia"        → "bank central asia"
 *   "Acme, Inc."               → "acme,"  (punctuation kept on purpose;
 *                                          callers may strip further)
 */
export function normalizeEntityName(name: string): string {
    let s = name.toLowerCase().replace(/\s+/g, " ").trim()
    // Drop a trailing period like "Tbk." → "tbk"
    const tokens = s.split(" ").filter(Boolean)

    // Strip leading legal prefixes
    while (tokens.length > 1 && LEGAL_PREFIX_SET.has(tokens[0])) {
        tokens.shift()
    }

    // Strip trailing legal suffixes (may chain: "Acme Co. Ltd." → "Acme")
    while (tokens.length > 1 && LEGAL_SUFFIX_SET.has(tokens[tokens.length - 1])) {
        tokens.pop()
    }

    s = tokens.join(" ").trim()
    // Strip surrounding punctuation but keep mid-word punctuation
    s = s.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    return s
}

export type DuplicateMatchKind = "exact" | "contains" | "prefix"

export interface DuplicateMatch<T> {
    record: T
    /** Strongest match kind found; `exact` is most confident. */
    kind: DuplicateMatchKind
    /** Pre-computed normalized form (for callers that want to display it). */
    normalized: string
}

interface DuplicateCheckOptions {
    /** Max suggestions to return. Defaults to 3. */
    limit?: number
    /** Min length for a normalized candidate to count as a "prefix" hit.
     *  Avoids matching every entity that starts with "ba" → "bank ...". */
    prefixMinLength?: number
}

/**
 * Find existing records whose name looks like the same entity as
 * `candidate`. Returns matches sorted from strongest to weakest.
 *
 * `getName` lets the caller adapt to entities whose name lives on a
 * different field (e.g. `full_name` for contacts, `name` for companies).
 *
 * Self-edits: callers updating an existing record should pass
 * `excludeId` so that record never matches itself.
 */
export function findDuplicateCandidates<T extends { id: string }>(
    candidate: string,
    existing: readonly T[],
    getName: (record: T) => string | null | undefined,
    options: DuplicateCheckOptions = {},
    excludeId?: string,
): DuplicateMatch<T>[] {
    const limit = options.limit ?? 3
    const prefixMinLength = options.prefixMinLength ?? 4

    const normCandidate = normalizeEntityName(candidate)
    if (!normCandidate) return []

    const matches: DuplicateMatch<T>[] = []

    for (const record of existing) {
        if (excludeId && record.id === excludeId) continue
        const raw = getName(record)
        if (!raw) continue
        const norm = normalizeEntityName(raw)
        if (!norm) continue

        if (norm === normCandidate) {
            matches.push({ record, kind: "exact", normalized: norm })
            continue
        }
        if (norm.includes(normCandidate) || normCandidate.includes(norm)) {
            matches.push({ record, kind: "contains", normalized: norm })
            continue
        }
        if (
            normCandidate.length >= prefixMinLength &&
            norm.length >= prefixMinLength &&
            norm.slice(0, prefixMinLength) === normCandidate.slice(0, prefixMinLength)
        ) {
            matches.push({ record, kind: "prefix", normalized: norm })
        }
    }

    // Sort: exact > contains > prefix; ties broken by shorter normalized
    // form (closer to the candidate's "essence").
    const rank: Record<DuplicateMatchKind, number> = { exact: 0, contains: 1, prefix: 2 }
    matches.sort((a, b) => {
        if (rank[a.kind] !== rank[b.kind]) return rank[a.kind] - rank[b.kind]
        return a.normalized.length - b.normalized.length
    })

    return matches.slice(0, limit)
}
