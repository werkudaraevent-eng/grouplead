"use client"

import { useCompany } from "@/contexts/company-context"

/**
 * Dims and disables the main content area while the company/unit switch is
 * re-fetching scoped server data. Keeps the previous data visible (so the user
 * keeps context) but clearly signals "updating…" without a blocking overlay or
 * center spinner — the pattern used by Linear/Vercel/Notion.
 */
export function ContentSwitchDim({ children }: { children: React.ReactNode }) {
    const { isSwitching } = useCompany()

    return (
        <div
            aria-busy={isSwitching}
            className={
                isSwitching
                    ? "opacity-60 pointer-events-none transition-opacity duration-200"
                    : "opacity-100 transition-opacity duration-200"
            }
        >
            {children}
        </div>
    )
}
