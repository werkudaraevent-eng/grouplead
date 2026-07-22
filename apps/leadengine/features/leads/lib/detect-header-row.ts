/**
 * Multi-Row Header Detection
 *
 * Real-world spreadsheets often have:
 *   Row 0: a banner / title (`DATA SOURCE WEEKLY GROUP LEADS 2026`)
 *   Row 1: merged group headers (`SOURCE KLIEN` covering several columns)
 *   Row 2: the actual column headers (`JML, #, CATEGORY, BU REVENUE, ...`)
 *
 * If we naively pick row 0 as the header, every column maps wrong. This
 * helper inspects the first N rows and picks the one most likely to be
 * the real header row using these signals:
 *
 *   1. Highest count of distinct non-empty string cells (banners and
 *      group-header rows have lots of empties).
 *   2. Cells should mostly be short string labels, not numbers or dates.
 *   3. The next row should look like data (mostly non-empty, mixed types).
 *
 * Returns the 0-based index of the detected header row.
 */

export interface DetectHeaderOptions {
    /** Maximum number of leading rows to consider. Default: 5. */
    maxScanRows?: number
}

export interface DetectHeaderResult {
    /** 0-based row index of the chosen header row. */
    headerRowIndex: number
    /** 0-based row index where data begins (== headerRowIndex + 1). */
    dataStartIndex: number
    /** Confidence 0..1 derived from heuristic scoring. */
    confidence: number
}

/**
 * Detect which row contains the actual column headers.
 *
 * @param rows The raw 2D array from XLSX.utils.sheet_to_json(ws, { header: 1 }).
 */
export function detectHeaderRow(
    rows: ReadonlyArray<ReadonlyArray<unknown>>,
    options: DetectHeaderOptions = {},
): DetectHeaderResult {
    const maxScan = Math.min(options.maxScanRows ?? 5, rows.length)
    if (maxScan === 0) {
        return { headerRowIndex: 0, dataStartIndex: 1, confidence: 0 }
    }

    let bestIdx = 0
    let bestScore = -Infinity

    for (let i = 0; i < maxScan; i++) {
        const score = scoreCandidateHeader(rows, i)
        if (score > bestScore) {
            bestScore = score
            bestIdx = i
        }
    }

    // Normalize score to 0..1 range. Top score is roughly column-count;
    // we cap denominator at 20 to keep small sheets from showing 1.0
    // confidence on a 3-column file.
    const colCount = rows[bestIdx]?.length ?? 0
    const denom = Math.max(10, Math.min(colCount, 30))
    const confidence = Math.max(0, Math.min(1, bestScore / denom))

    return {
        headerRowIndex: bestIdx,
        dataStartIndex: bestIdx + 1,
        confidence,
    }
}

/**
 * Score a candidate header row. Higher is more header-like.
 *
 * Heuristics:
 *   +1 per distinct non-empty short string cell (header label).
 *   -2 per numeric cell (banners are text; data rows are numeric).
 *   -1 if cell length > 60 chars (likely a banner sentence).
 *   +0.5 if next row exists and has more non-empty cells than this row
 *        (data row should be denser than header).
 */
function scoreCandidateHeader(
    rows: ReadonlyArray<ReadonlyArray<unknown>>,
    rowIdx: number,
): number {
    const row = rows[rowIdx] ?? []
    let score = 0
    const seen = new Set<string>()

    for (const cell of row) {
        if (cell === null || cell === undefined || cell === "") continue

        if (typeof cell === "number") {
            score -= 2
            continue
        }

        if (typeof cell === "string") {
            const trimmed = cell.trim()
            if (!trimmed) continue
            if (trimmed.length > 60) {
                score -= 1
                continue
            }
            // Distinct non-empty labels get the points.
            if (!seen.has(trimmed.toLowerCase())) {
                seen.add(trimmed.toLowerCase())
                score += 1
            }
        }
    }

    // Bonus if data row below is denser than this candidate.
    const next = rows[rowIdx + 1]
    if (next) {
        const headerNonEmpty = (row || []).filter(
            (c) => c !== null && c !== undefined && c !== "",
        ).length
        const dataNonEmpty = next.filter(
            (c) => c !== null && c !== undefined && c !== "",
        ).length
        if (dataNonEmpty > headerNonEmpty) score += 0.5
    }

    return score
}

/**
 * Build the parsed `{ headers, rows }` shape from a raw 2D array using the
 * detected header row. Empty trailing columns are kept so column-count
 * positions stay stable across rows.
 */
export function buildHeaderAndRows(
    raw: ReadonlyArray<ReadonlyArray<unknown>>,
    detection: DetectHeaderResult,
): {
    headers: string[]
    rows: Record<string, string>[]
} {
    const headerRow = raw[detection.headerRowIndex] ?? []
    const headers = headerRow.map((cell, i) => {
        const v = cell == null ? "" : String(cell).trim()
        return v || `Column ${i + 1}`
    })

    const dataRows: Record<string, string>[] = []
    for (let r = detection.dataStartIndex; r < raw.length; r++) {
        const src = raw[r] ?? []
        // Skip fully empty rows (Excel often has phantom trailing rows).
        const hasAny = src.some((c) => c !== null && c !== undefined && c !== "")
        if (!hasAny) continue
        const obj: Record<string, string> = {}
        for (let c = 0; c < headers.length; c++) {
            const v = src[c]
            obj[headers[c]] = v == null ? "" : String(v)
        }
        dataRows.push(obj)
    }

    return { headers, rows: dataRows }
}
