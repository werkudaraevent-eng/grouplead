/**
 * Parse a free-form destination cell into normalized `{ city, venue }[]`.
 *
 * Werkudara recap mixes a lot of separators in the LOKASI column:
 *   - "JAKARTA, SURABAYA"             (comma list)
 *   - "BANDUNG / LOMBOK / LAMPUNG"    (slash list)
 *   - "BALI AND LABUAN BAJO"          (AND separator)
 *   - "BANDUNG/TEGAL"                 (no spaces around slash)
 *   - "Yogyakarta"                    (single value, mixed case)
 *
 * We split on any of these separators, normalize each city against the
 * `event_city` master options (case-insensitive exact match), and fall
 * back to a smart-cased raw value with a warning so the lead still imports.
 */
import { smartTitleCase } from "@/utils/smart-title-case"

export interface ParsedDestination {
    city: string
    venue: string
}

export interface ParsedDestinationsResult {
    destinations: ParsedDestination[]
    /** Per-city warnings when a value doesn't match a master option. */
    warnings: string[]
}

/**
 * @param cityCell    The raw value of the destination_city column.
 * @param venueCell   The raw value of the destination_venue column. Applied
 *                    to every parsed city (single venue → many cities).
 * @param optionMap   Map keyed `event_city|<lowercase value>` → canonical
 *                    value. Same shape used elsewhere in the import pipeline.
 */
export function parseDestinations(
    cityCell: string,
    venueCell: string,
    optionMap: Map<string, string>,
): ParsedDestinationsResult {
    const trimmed = (cityCell ?? "").trim()
    const venue = (venueCell ?? "").trim()
    if (!trimmed) return { destinations: [], warnings: [] }

    // Split on common separators. \s*AND\s* is case-insensitive but we
    // upper-case the input first to avoid breaking words like "Bandung".
    // Order matters: split on comma + slash first, then within each chunk
    // try AND so a value like "BALI AND LABUAN BAJO" still works.
    const rawParts = trimmed
        .split(/[,;]|\s\/\s|\/\s|\s\/|\//)
        .flatMap((p) => p.split(/\s+AND\s+/i))
        .map((p) => p.trim())
        .filter(Boolean)

    const destinations: ParsedDestination[] = []
    const warnings: string[] = []
    const seen = new Set<string>()

    for (const part of rawParts) {
        const lookup = optionMap.get(`event_city|${part.toLowerCase()}`)
        let canonical: string
        if (lookup) {
            canonical = lookup
        } else {
            // Smart-case the raw value (JAKARTA → Jakarta) and surface a
            // warning so the importer can add it to master options later.
            canonical = smartTitleCase(part) ?? part
            warnings.push(
                `Destination "${canonical}" doesn't match an existing City option — kept as-is`,
            )
        }
        const dedupeKey = canonical.toLowerCase()
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)
        destinations.push({ city: canonical, venue })
    }

    return { destinations, warnings }
}
