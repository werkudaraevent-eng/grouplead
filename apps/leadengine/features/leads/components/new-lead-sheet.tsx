"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Loader2 } from "@/components/icons"
import { LeadForm } from "./lead-form"
import { pickPipelineId, readStoredPipelineId } from "../lib/new-lead-pipeline"

/**
 * New lead from a record's page (a contact, a company): the Pipeline's own
 * Add lead sheet and form, with the client company and the contact person
 * already filled in. The lead goes into the pipeline the person last had
 * open on the Pipeline page (else the first active one), resolved before
 * the form mounts, since the form loads that pipeline's stages once.
 * Saving opens the new lead, as it does from the Pipeline.
 */
export function NewLeadSheet({ open, onOpenChange, clientCompanyId, contactId }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    clientCompanyId?: string | null
    contactId?: string | null
}) {
    const [pipelineId, setPipelineId] = useState<string | null | undefined>(undefined)

    useEffect(() => {
        if (!open || pipelineId !== undefined) return
        let cancelled = false
        createClient()
            .from("pipelines")
            .select("id")
            .eq("is_active", true)
            .order("created_at", { ascending: true })
            .then(({ data }) => {
                if (cancelled) return
                setPipelineId(pickPipelineId((data ?? []) as { id: string }[], readStoredPipelineId()))
            })
        return () => { cancelled = true }
    }, [open, pipelineId])

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="flex w-full flex-col overflow-hidden border-l border-border p-0 sm:max-w-2xl"
                onInteractOutside={(event) => event.preventDefault()}
            >
                <SheetTitle className="sr-only">New lead</SheetTitle>
                <SheetDescription className="sr-only">Create a lead for this record.</SheetDescription>
                {pipelineId === undefined ? (
                    <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading the form…
                    </div>
                ) : (
                    <LeadForm
                        pipelineId={pipelineId ?? undefined}
                        prefill={{ client_company_id: clientCompanyId ?? null, contact_id: contactId ?? null }}
                        onClose={() => onOpenChange(false)}
                    />
                )}
            </SheetContent>
        </Sheet>
    )
}
