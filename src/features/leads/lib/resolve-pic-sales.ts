/**
 * Resolve a free-form PIC Sales name (typed by humans, often a first name
 * only or ALL-CAPS) to an actual `profiles.id`.
 *
 * Werkudara recap convention writes PICs like "ADIEL", "ANWAR", "MITHA" —
 * just first names. The profiles table stores full names like "Adiel Pratama".
 * Without fuzzy matching every imported lead lands as Unassigned.
 *
 * Strategy (first hit wins):
 *   1. Exact case-insensitive match on full_name.
 *   2. First name match — input matches the FIRST token of any profile.
 *      Used when only one profile starts with that token (avoid ambiguity).
 *   3. Substring match — input is contained in any profile's full_name
 *      (or vice versa) and the match is unique.
 *   4. Bigram-Dice similarity ≥ 0.6, picking the highest score among
 *      candidates that are clearly above the next-best.
 *
 * Returns:
 *   - `{ id, matched: 'exact' | 'first' | 'substring' | 'fuzzy', via }` on hit
 *   - `null` when no confident match exists
 */

export interface ProfileLite {
    id: string
    full_name: string | null
}

export interface PicResolveResult {
    id: string
    matched: "exact" | "first" | "substring" | "fuzzy"
    via: string
    confidence: number
}

export function resolvePicSales(
    input: string,
    profiles: ReadonlyArray<ProfileLite>,
): PicResolveResult | null {
    if (!input || !profiles.length) return null

    const needle = input.trim()
    if (!needle) return null
    const needleLower = needle.toLowerCase()

    // Tier 1: exact case-insensitive full_name.
    for (const p of profiles) {
        if (!p.full_name) continue
        if (p.full_name.toLowerCase().trim() === needleLower) {
            return { id: p.id, matched: "exact", via: p.full_name, confidence: 1 }
        }
    }

    // Tier 2: first-name match. "ADIEL" → "Adiel Pratama".
    // Only auto-pick when exactly one profile starts with that token.
    const firstNameHits = profiles.filter((p) => {
        const first = (p.full_name ?? "").trim().split(/\s+/)[0]
        return first.toLowerCase() === needleLower
    })
    if (firstNameHits.length === 1 && firstNameHits[0].full_name) {
        return {
            id: firstNameHits[0].id,
            matched: "first",
            via: firstNameHits[0].full_name,
            confidence: 0.95,
        }
    }

    // Tier 3: substring (either direction) with unique winner.
    const substringHits = profiles.filter((p) => {
        if (!p.full_name) return false
        const fn = p.full_name.toLowerCase()
        return fn.includes(needleLower) || needleLower.includes(fn)
    })
    if (substringHits.length === 1 && substringHits[0].full_name) {
        return {
            id: substringHits[0].id,
            matched: "substring",
            via: substringHits[0].full_name,
            confidence: 0.85,
        }
    }

    // Tier 4: bigram-Dice similarity on the full string.
    let best: { p: ProfileLite; score: number } | null = null
    let secondBest = 0
    for (const p of profiles) {
        if (!p.full_name) continue
        const score = diceBigram(needleLower, p.full_name.toLowerCase().trim())
        if (!best || score > best.score) {
            secondBest = best?.score ?? 0
            best = { p, score }
        } else if (score > secondBest) {
            secondBest = score
        }
    }
    // Require ≥ 0.6 absolute and > 0.1 above the runner-up to avoid
    // picking arbitrarily between similar names.
    if (best && best.score >= 0.6 && best.score - secondBest >= 0.1 && best.p.full_name) {
        return {
            id: best.p.id,
            matched: "fuzzy",
            via: best.p.full_name,
            confidence: best.score,
        }
    }

    return null
}

/** Dice coefficient on character bigrams (0..1). */
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
