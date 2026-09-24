"use client"

import { useState, type ReactNode } from "react"
import { Bookmark, Check, Loader2, Star } from "@/components/icons"
import { BottomSheet, SheetRow } from "@/components/ui/bottom-sheet"
import { cn } from "@/lib/utils"
import type { DashboardView } from "@/types/dashboard-view"

/**
 * The dashboard's saved views on a phone, opened from "Views" in the top app
 * bar's ⋮ (the desk's view switcher sits in the header row, which a phone
 * does not draw). Choosing a view is the phone's job, and so is keeping the
 * filters set here in the view in hand; arranging the widgets and renaming,
 * duplicating or deleting views need the desk's grid and dialogs, and the
 * sheet says so rather than offering them (Sales Activity's Ringkasan:
 * "arranging is a desk job"). M3 modal bottom sheet with a radio list, the
 * choice on the tonal fill with a check, like the More sheet's unit list.
 */
export function DashboardViewsSheet({
    open,
    onOpenChange,
    views,
    activeView,
    loading,
    hasUnsavedChanges,
    onSelectView,
    onSaveCurrent,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    views: DashboardView[]
    activeView: DashboardView | null
    loading: boolean
    hasUnsavedChanges: boolean
    onSelectView: (id: string) => void
    onSaveCurrent: () => Promise<unknown> | void
}) {
    const [saving, setSaving] = useState(false)

    return (
        <BottomSheet open={open} onOpenChange={onOpenChange} title="Views" description="Each view keeps its own widgets and filters.">
            <div className="px-2">
                {loading ? (
                    <p className="flex min-h-14 items-center gap-3 px-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading views…
                    </p>
                ) : views.length === 0 ? (
                    // No view saved yet: the dashboard shows its default,
                    // named as the desk's switcher names it.
                    <div role="radiogroup" aria-label="Dashboard views">
                        <div
                            role="radio"
                            aria-checked
                            className="flex min-h-14 w-full items-center gap-4 rounded-xl bg-[var(--tonal)] px-4 text-sm font-medium text-[var(--tonal-foreground)]"
                        >
                            <Bookmark className="h-5 w-5 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate">Default view</span>
                            <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
                        </div>
                    </div>
                ) : (
                    <div role="radiogroup" aria-label="Dashboard views" className="space-y-1">
                        {views.map((view) => {
                            const checked = view.id === activeView?.id
                            return (
                                <button
                                    key={view.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={checked}
                                    onClick={() => {
                                        if (!checked) onSelectView(view.id)
                                        onOpenChange(false)
                                    }}
                                    className={cn(
                                        "flex min-h-14 w-full items-center gap-4 rounded-xl px-4 text-left text-sm transition-colors",
                                        checked ? "bg-[var(--tonal)] font-medium text-[var(--tonal-foreground)]" : "text-foreground hover:bg-muted",
                                    )}
                                >
                                    <Bookmark className={cn("h-5 w-5 shrink-0", !checked && "text-muted-foreground")} aria-hidden="true" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate">{view.name}</span>
                                        {view.is_default && (
                                            <span className={cn("flex items-center gap-1 text-xs font-normal", !checked && "text-muted-foreground")}>
                                                <Star className="h-3 w-3" aria-hidden="true" /> Default
                                            </span>
                                        )}
                                    </span>
                                    {checked && <Check className="h-5 w-5 shrink-0" aria-hidden="true" />}
                                </button>
                            )
                        })}
                    </div>
                )}
                {activeView && hasUnsavedChanges && (
                    <div className="mt-1 border-t pt-1">
                        <SheetRow
                            icon={Bookmark}
                            label={saving ? "Saving…" : "Save changes to this view"}
                            hint={`Keeps the filters you set here in “${activeView.name}”`}
                            disabled={saving}
                            onClick={async () => {
                                setSaving(true)
                                try {
                                    await onSaveCurrent()
                                } finally {
                                    setSaving(false)
                                    onOpenChange(false)
                                }
                            }}
                        />
                    </div>
                )}
            </div>
            <p className="px-6 pt-3 text-sm text-muted-foreground">
                To arrange the widgets, or to rename, duplicate or delete a view, open the dashboard on a computer.
            </p>
        </BottomSheet>
    )
}

/**
 * What each number card counts, for a touch screen: on a desk the same text
 * is the tooltip of the ⓘ beside the filters and on each card, which a
 * finger cannot hover. Opened from "How the numbers are counted" in the top
 * app bar's ⋮.
 */
export function DashboardCountingSheet({
    open,
    onOpenChange,
    cards,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    cards: { label: string; info: ReactNode }[]
}) {
    return (
        <BottomSheet
            open={open}
            onOpenChange={onOpenChange}
            title="How the numbers are counted"
            description="Each card uses the date that fits what it measures: when leads came in, when deals closed, or when revenue is recognized."
        >
            <div className="space-y-2 px-4">
                {cards.map((card) => (
                    <div key={card.label} className="rounded-xl bg-muted px-4 py-3 text-sm leading-snug text-foreground">
                        {card.info}
                    </div>
                ))}
            </div>
        </BottomSheet>
    )
}
