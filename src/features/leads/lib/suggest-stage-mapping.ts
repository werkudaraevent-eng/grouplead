/**
 * Default Stage Suggestion Heuristics
 *
 * When a user uploads a spreadsheet for the first time we try to suggest
 * sensible source-value → target-stage mappings based on common phrases:
 *
 *   "MATERIALIZED" / "WON" / "CLOSED WON"   → won-type stage
 *   "LOST"   / "TURNDOWN" / "CANCELLED"     → lost-type stage
 *   "TENTATIVE" / "ESTIMATION" / "INQUIRY"  → first open stage
 *   "CONFIRMED" / "PROPOSAL" / "NEGOTIATION" → middle open stage
 *   "POSTPONED" / "ON HOLD"                  → middle open stage (last open)
 *
 * The user can override anything we suggest before saving.
 */

export interface StageInfo {
    id: string
    name: string
    sort_order: number
    closed_status?: "won" | "lost" | null
}

interface Suggestion {
    /** 0..1, higher means more confident the user wanted this mapping. */
    score: number
    targetStageId: string
}

/**
 * Suggest a target stage for a single source-value string.
 * Returns null if no good guess exists (user must pick manually).
 */
export function suggestTargetStage(
    sourceValue: string,
    stages: StageInfo[],
): Suggestion | null {
    if (!sourceValue || !stages.length) return null
    const v = sourceValue.toLowerCase().trim()

    // Sort once for predictable picks.
    const ordered = [...stages].sort((a, b) => a.sort_order - b.sort_order)
    const wonStage = ordered.find((s) => s.closed_status === "won")
    const lostStage = ordered.find((s) => s.closed_status === "lost")
    const openStages = ordered.filter((s) => s.closed_status == null)
    const firstOpen = openStages[0] ?? null
    const lastOpen = openStages[openStages.length - 1] ?? null
    const midOpen = openStages.length > 0
        ? openStages[Math.floor(openStages.length / 2)]
        : null

    // ── Won-like ──────────────────────────────────────────────────
    if (
        /\b(materialized|materialised|won|deal|booked|signed|closed.?won)\b/.test(v)
    ) {
        if (wonStage) return { score: 0.95, targetStageId: wonStage.id }
    }

    // ── Lost-like ─────────────────────────────────────────────────
    if (
        /\b(lost|turndown|turn.?down|cancel(led|ed)?|reject(ed)?|no.?go|dropped)\b/.test(v)
    ) {
        if (lostStage) return { score: 0.95, targetStageId: lostStage.id }
    }

    // ── Postponed / on-hold → last open (closest to closing) ─────
    if (/\b(postpon\w*|on.?hold|hold|paused|delayed)\b/.test(v)) {
        if (lastOpen) return { score: 0.7, targetStageId: lastOpen.id }
    }

    // ── Tentative / inquiry → first open ─────────────────────────
    if (/\b(tentative|inquiry|enquiry|new|lead.?masuk|incoming|fresh|prospect)\b/.test(v)) {
        if (firstOpen) return { score: 0.85, targetStageId: firstOpen.id }
    }

    // ── Confirmed / proposal / negotiation → middle open ─────────
    if (
        /\b(confirm(ed)?|proposal|quotation|negotiat(e|ion)|estimation|pending|in.?progress)\b/.test(v)
    ) {
        if (midOpen) return { score: 0.75, targetStageId: midOpen.id }
    }

    // ── Direct stage name substring match ────────────────────────
    for (const s of ordered) {
        const sn = s.name.toLowerCase()
        if (sn === v || sn.includes(v) || v.includes(sn)) {
            return { score: 0.9, targetStageId: s.id }
        }
    }

    return null
}

/**
 * Suggest mappings for an entire set of distinct source values.
 */
export function suggestStageMappings(
    sourceValues: string[],
    stages: StageInfo[],
): Record<string, string> {
    const out: Record<string, string> = {}
    for (const v of sourceValues) {
        const s = suggestTargetStage(v, stages)
        if (s) out[v] = s.targetStageId
    }
    return out
}
