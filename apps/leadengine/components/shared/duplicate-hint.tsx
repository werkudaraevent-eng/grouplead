"use client"

import { useMemo } from "react"
import { AlertTriangle } from "lucide-react"
import {
    findDuplicateCandidates,
    type DuplicateMatch,
} from "@/lib/duplicate-detection"

interface DuplicateHintProps<T extends { id: string }> {
    /** Current value of the name input. */
    value: string | null | undefined
    /** All existing records to scan against. Caller is responsible for
     *  fetching / scoping these (e.g. `client_companies` for the active
     *  company). Cheap to pass — soft-match runs in-memory. */
    existing: readonly T[]
    /** Returns the human-readable name from a record. */
    getName: (record: T) => string | null | undefined
    /** Pass when editing so the record being edited never matches itself. */
    excludeId?: string
    /** Called when the user clicks a suggestion. Caller decides what to
     *  do (link to the existing record, navigate away, …). Optional. */
    onSelect?: (match: DuplicateMatch<T>) => void
    /** Singular noun used in the hint text. Defaults to "record". */
    entityNoun?: string
}

/**
 * Inline soft-suggest hint that surfaces existing records that look
 * like duplicates of the current input. Stays silent until the user
 * has typed at least 4 characters AND a candidate matches.
 *
 * Default behaviour is informational — clicking a suggestion just
 * highlights it visually. Pass `onSelect` to wire it (e.g. open the
 * record, fill the form, navigate, etc.).
 */
export function DuplicateHint<T extends { id: string }>({
    value,
    existing,
    getName,
    excludeId,
    onSelect,
    entityNoun = "record",
}: DuplicateHintProps<T>) {
    const matches = useMemo(() => {
        if (!value || value.trim().length < 4) return []
        return findDuplicateCandidates(value, existing, getName, { limit: 3 }, excludeId)
    }, [value, existing, getName, excludeId])

    if (matches.length === 0) return null

    const top = matches[0]
    const headline =
        top.kind === "exact"
            ? `Looks like an existing ${entityNoun}`
            : `Possible duplicate ${entityNoun}${matches.length > 1 ? "s" : ""}`

    return (
        <div className="mt-1 rounded-md bg-orange-50 border border-orange-200 px-2 py-1.5 text-[11px] text-orange-900">
            <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 shrink-0 text-orange-600" />
                <span className="font-semibold">{headline}</span>
            </div>
            <ul className="mt-1 space-y-0.5">
                {matches.map(m => (
                    <li key={m.record.id} className="flex items-center gap-2">
                        <span className="opacity-50 uppercase tracking-wider text-[9px]">{m.kind}</span>
                        <button
                            type="button"
                            onClick={() => onSelect?.(m)}
                            className="truncate text-left hover:underline"
                            title={getName(m.record) ?? ""}
                        >
                            {getName(m.record)}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}
