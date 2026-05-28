"use client"

import { useMemo } from "react"
import { Sparkles } from "lucide-react"
import { suggestTitleCase } from "@/lib/text-normalize"

interface TitleCaseHintProps {
    /** Current value of the input. */
    value: string | null | undefined
    /** Called when the user clicks "Use suggested" — receive the cleaned form. */
    onApply: (suggested: string) => void
    /** Custom CTA label. Defaults to "Use suggested". */
    ctaLabel?: string
}

/**
 * Inline soft-suggest hint that appears below an input when the value
 * looks like ALL CAPS or near-all-caps. Calls `onApply` with the
 * smart-title-cased version. Renders nothing when there is no
 * suggestion (already well-cased, too short, or empty).
 *
 * Reuses `suggestTitleCase` from `src/lib/text-normalize.ts` which
 * delegates to `smartTitleCase` so Indonesian acronyms (PT, BCA, Tbk
 * via the known-abbreviations list) survive the rewrite.
 */
export function TitleCaseHint({ value, onApply, ctaLabel = "Use suggested" }: TitleCaseHintProps) {
    const suggested = useMemo(() => suggestTitleCase(value ?? null), [value])

    if (!suggested) return null

    return (
        <div className="mt-1 flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-[11px] text-amber-900">
            <Sparkles className="h-3 w-3 shrink-0 text-amber-600" />
            <span className="opacity-70">Looks like all caps. Try</span>
            <span className="font-semibold truncate" title={suggested}>{suggested}</span>
            <button
                type="button"
                onClick={() => onApply(suggested)}
                className="ml-auto shrink-0 rounded bg-amber-100 hover:bg-amber-200 px-2 py-0.5 font-semibold text-amber-900 transition-colors"
            >
                {ctaLabel}
            </button>
        </div>
    )
}
