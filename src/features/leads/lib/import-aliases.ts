/**
 * Import Header Alias Dictionary
 *
 * Maps common header variations from real-world spreadsheets (Werkudara
 * Group Lead 2026 Recap, etc.) onto our canonical SYSTEM_FIELDS keys.
 *
 * Lookup is case- and whitespace-insensitive, so callers should normalize
 * incoming headers via `normalizeHeaderKey()` before searching.
 *
 * Each canonical key has an array of accepted aliases. The first entry is
 * the conventional preferred phrasing; ordering doesn't affect matching.
 */

export type FieldAliasMap = Record<string, readonly string[]>

export const FIELD_ALIASES: FieldAliasMap = {
    // ── Project tab ─────────────────────────────────────────────
    project_name: [
        "project name", "name of project", "nama proyek", "nama project",
        "project", "judul project", "judul proyek",
    ],
    subsidiary_name: [
        "subsidiary", "subsidiary / business unit", "business unit",
        "bu", "bu revenue", "bu_revenue", "subs", "main bu",
    ],
    category: [
        "category", "lead category", "kategori",
    ],
    grade_lead: [
        "grade lead", "lead grade", "grade", "grading",
    ],
    client_company_name: [
        "client company", "company", "client", "company name",
        "client name", "main company", "perusahaan klien", "nama perusahaan",
        "account", "client account",
    ],
    contact_name: [
        "contact person", "contact full name", "contact name",
        "full name", "nama kontak", "person in charge",
        "contact", "pic client",
    ],
    pic_sales_name: [
        "pic sales", "sales", "sales pic", "salesperson",
        "account manager", "owner", "lead owner",
    ],
    lead_source: [
        "lead source", "source lead", "source", "sumber lead",
        "channel", "marketing channel",
    ],
    referral_source: [
        "referral", "referral source", "referrer", "referensi",
    ],
    target_close_date: [
        "target close date", "est. closing date", "estimated closing date",
        "expected close date", "close date target", "tgl target close",
    ],

    // ── Event tab ───────────────────────────────────────────────
    event_dates: [
        "event dates", "event date", "date of event", "tanggal event",
        "tanggal acara", "jadwal event", "event schedule",
    ],
    pax_count: [
        "pax count", "pax", "no. of pax", "no of pax", "number of pax",
        "jumlah peserta", "peserta", "head count", "headcount",
    ],
    event_format: [
        "event format", "format event", "format acara", "type", "type event",
    ],
    virtual_platform: [
        "virtual platform", "platform", "online platform", "v-platform",
    ],
    destination_city: [
        "destination city", "event city", "lokasi (nama kota)", "city",
        "kota", "lokasi", "lokasi event", "destinasi", "destination",
    ],
    destination_venue: [
        "venue", "venue/ hotel", "venue / hotel", "hotel", "lokasi venue",
        "tempat", "destinasi venue",
    ],

    // ── Classification tab ──────────────────────────────────────
    main_stream: [
        "main stream", "stream", "main_stream",
    ],
    stream_type: [
        "stream type", "tipe stream", "type stream", "stream_type",
    ],
    business_purpose: [
        "business purpose", "purpose", "tujuan bisnis", "tipe", "type",
    ],
    area: [
        "area", "wilayah", "region",
    ],

    // ── Financial tab ───────────────────────────────────────────
    estimated_value: [
        "estimated value", "est revenue", "est. revenue", "estimated revenue",
        "nilai estimasi", "est value", "estimasi nilai", "value",
    ],

    // ── Pipeline & status ───────────────────────────────────────
    pipeline_stage_name: [
        "pipeline stage", "stage", "stages", "current stage",
        "tahap pipeline", "tahap",
    ],
    status: [
        "status", "lead status", "status lead", "current status",
    ],

    // ── Notes ───────────────────────────────────────────────────
    general_brief: [
        "general brief", "brief", "briefing", "client brief",
    ],
    production_sow: [
        "production sow", "sow", "scope of work", "production scope",
    ],
    special_remarks: [
        "special remarks", "special remark", "remarks", "catatan khusus",
    ],
    description: [
        "description", "deskripsi", "details",
    ],
    remark: [
        "remark", "note", "notes", "catatan",
    ],

    // ── Historical fields ───────────────────────────────────────
    created_at: [        "received date", "month received lead", "date received",        "created date", "created at", "date created", "inquiry date",
        "tanggal buat", "tanggal dibuat", "month receive lead",
        "tgl time lead terima", "lead received", "year lead receive",
    ],
    actual_value: [
        "actual value", "actual revenue", "revenue", "nilai aktual",
        "materialized", "nominal konfirmasi",
    ],
    closed_won_date: [
        "closed won date", "won date", "date won", "tanggal won",
        "date client confirm",
    ],
    closed_lost_date: [
        "closed lost date", "lost date", "date lost", "tanggal lost",
        "date cxl/ lost", "month cxl/ lost/ turndown",
    ],
    lost_reason: [
        "lost reason", "reason", "alasan lost", "cancel/ lost/ post reason",
        "cancel lost reason",
    ],
}

/**
 * Normalize a header for alias lookup: lowercase, collapse internal
 * whitespace, strip surrounding spaces, replace runs of non-alphanumeric
 * characters with a single space.
 */
export function normalizeHeaderKey(input: string): string {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
}

const ALIAS_INDEX: Map<string, string> = (() => {
    const m = new Map<string, string>()
    for (const [fieldKey, aliases] of Object.entries(FIELD_ALIASES)) {
        // Always allow the canonical key itself.
        m.set(normalizeHeaderKey(fieldKey), fieldKey)
        for (const alias of aliases) {
            m.set(normalizeHeaderKey(alias), fieldKey)
        }
    }
    return m
})()

/**
 * Resolve a raw header (any casing/spacing) to a canonical SYSTEM_FIELDS
 * key, or null if no alias matches.
 */
export function resolveFieldByAlias(rawHeader: string): string | null {
    return ALIAS_INDEX.get(normalizeHeaderKey(rawHeader)) ?? null
}

/**
 * Token-based Jaccard similarity for header fallback when alias misses.
 * Returns 0..1.
 */
function tokenJaccard(a: string, b: string): number {
    const ta = new Set(a.split(" ").filter(Boolean))
    const tb = new Set(b.split(" ").filter(Boolean))
    if (ta.size === 0 || tb.size === 0) return 0
    let intersect = 0
    for (const t of ta) if (tb.has(t)) intersect++
    return intersect / (ta.size + tb.size - intersect)
}

/**
 * Dice coefficient on character bigrams. Tolerates partial words much
 * better than token-level Jaccard ("project nam" vs "project name" gets
 * a high score because they share most bigrams).
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
 * Best-effort fuzzy match: returns the canonical field key with the highest
 * combined token-Jaccard + bigram-Dice similarity ≥ threshold, or null.
 * Used as fallback after exact alias lookup misses.
 */
export function fuzzyMatchFieldKey(
    rawHeader: string,
    threshold = 0.6,
): { fieldKey: string; score: number } | null {
    const norm = normalizeHeaderKey(rawHeader)
    if (!norm) return null

    let best: { fieldKey: string; score: number } | null = null
    for (const [aliasNorm, fieldKey] of ALIAS_INDEX) {
        // Combined score: weighted average favoring bigram for partial-word
        // tolerance, with a token-overlap floor for short headers.
        const bigram = diceBigram(norm, aliasNorm)
        const tokens = tokenJaccard(norm, aliasNorm)
        const score = Math.max(bigram, 0.4 * tokens + 0.6 * bigram)
        if (score >= threshold && (!best || score > best.score)) {
            best = { fieldKey, score }
        }
    }
    return best
}
