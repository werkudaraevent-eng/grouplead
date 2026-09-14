"use client"

import { useState, useTransition } from "react"
import { GitMerge, Loader2 } from "@/components/icons"
import { toast } from "sonner"
import { mergeClientCompaniesAction } from "@/app/actions/company-actions"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export interface MergeCandidate {
    id: string
    name: string
    industry: string | null
    city: string | null
    lead_count?: number
    contact_count?: number
}

/**
 * Fold two companies into one.
 *
 * The one decision the admin makes here is which record survives. Everything
 * else is mechanical and irreversible in the ordinary sense (the loser goes to
 * the Recycle Bin, but its leads and contacts have moved), so the dialog shows
 * exactly what each side holds and names the outcome in one sentence before
 * the button is enabled.
 */
export function MergeCompaniesDialog({
    open,
    onOpenChange,
    candidates,
    onMerged,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Exactly two, in any order. */
    candidates: [MergeCandidate, MergeCandidate] | null
    onMerged?: () => void
}) {
    const [winnerId, setWinnerId] = useState<string | null>(null)
    const [pending, start] = useTransition()

    if (!candidates) return null
    const [a, b] = candidates
    const winner = candidates.find(c => c.id === winnerId) ?? null
    const loser = winner ? candidates.find(c => c.id !== winner.id)! : null

    const merge = () => {
        if (!winner || !loser) return
        start(async () => {
            const result = await mergeClientCompaniesAction(winner.id, loser.id)
            if (!result.success) { toast.error(result.error || "Merge failed"); return }
            toast.success(`"${loser.name}" merged into "${winner.name}"`)
            setWinnerId(null)
            onOpenChange(false)
            onMerged?.()
        })
    }

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!pending) { onOpenChange(next); if (!next) setWinnerId(null) } }}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Merge two companies</DialogTitle>
                    <DialogDescription>
                        Choose the record to keep. The other one&apos;s leads, contacts, notes, attachments and
                        field visits move across, its blank details fill the gaps, and it goes to the Recycle Bin.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Company to keep">
                    {[a, b].map(candidate => {
                        const selected = winnerId === candidate.id
                        return (
                            <button
                                key={candidate.id}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => setWinnerId(candidate.id)}
                                className={cn(
                                    "rounded-lg border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                    selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                                )}
                            >
                                <p className="font-semibold text-foreground">{candidate.name}</p>
                                <p className="mt-0.5 text-[12px] text-muted-foreground">
                                    {[candidate.industry, candidate.city].filter(Boolean).join(" · ") || "No details yet"}
                                </p>
                                <dl className="mt-3 flex gap-4 text-[12px]">
                                    <div><dt className="text-muted-foreground">Leads</dt><dd className="font-semibold tabular-nums text-foreground">{candidate.lead_count ?? "—"}</dd></div>
                                    <div><dt className="text-muted-foreground">Contacts</dt><dd className="font-semibold tabular-nums text-foreground">{candidate.contact_count ?? "—"}</dd></div>
                                </dl>
                                <p className={cn("mt-3 text-[12px] font-semibold", selected ? "text-primary" : "text-muted-foreground")}>
                                    {selected ? "Keep this one" : "Click to keep"}
                                </p>
                            </button>
                        )
                    })}
                </div>

                {winner && loser && (
                    <p className="rounded-md bg-muted/60 px-3 py-2 text-[13px] text-foreground">
                        <strong>{loser.name}</strong> will be folded into <strong>{winner.name}</strong>.
                        Its name is kept in the Recycle Bin, marked as merged.
                    </p>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                    <Button onClick={merge} disabled={!winner || pending}>
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
                        Merge
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
