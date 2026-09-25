"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { SearchField } from "@/components/shared/search-field"
import { ChevronLeft, ChevronRight } from "@/components/icons"
import { useCurrency } from "@/contexts/currency-context"
import { useRowLink } from "@/hooks/use-row-link"
import { cn } from "@/lib/utils"
import { formatCalendarDay, leadStanding, leadSummaryLabel, summarizeContactLeads, type LeadStageFacts, type LeadStanding } from "../lib/contact-record"

export interface ContactLead {
    id: number
    project_name: string | null
    estimated_value: number | null
    status: string | null
    target_close_date: string | null
    pipeline_stage: (LeadStageFacts & { name: string; color?: string | null }) | null
    pic_sales_profile: { full_name: string } | null
}

const PAGE_SIZE = 5

/** Token tones, as the Pipeline's phone cards give them (DESIGN.md, Tokens). */
const STANDING_TONE: Record<LeadStanding, string> = {
    open: "bg-primary/10 text-primary",
    won: "bg-[var(--success)] text-[var(--success-foreground)]",
    lost: "bg-[var(--danger)] text-[var(--danger-foreground)]",
    closed: "bg-muted text-foreground",
}

function StageChip({ stage }: { stage: ContactLead["pipeline_stage"] }) {
    if (!stage) return <span className="text-muted-foreground">No stage</span>
    return (
        <span className={cn("inline-flex h-6 max-w-full items-center rounded-md px-2 text-xs font-medium", STANDING_TONE[leadStanding(stage)])}>
            <span className="truncate">{stage.name}</span>
        </span>
    )
}

/**
 * The leads that name this contact as their contact person. The heading
 * carries one line in place of the four number cards that stood above the
 * page ("2 active · Rp 1.2B · 1 won"), then the leads five at a time: a
 * table from `md` (sentence-case headers at the body's size, 52dp rows, the
 * row opening its lead), one row per lead with its facts under the name on
 * a phone. The search appears once there is more than a page of them.
 */
export function ContactLeadsSection({ leads, headingId }: { leads: ContactLead[]; headingId: string }) {
    const { fmt, fmtAxis } = useCurrency()
    const rowLink = useRowLink()
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(0)
    const onSearch = useCallback((value: string) => { setSearch(value); setPage(0) }, [])

    const summary = useMemo(() => leadSummaryLabel(summarizeContactLeads(leads), fmtAxis), [leads, fmtAxis])
    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return leads
        return leads.filter((lead) =>
            lead.project_name?.toLowerCase().includes(query) || lead.pic_sales_profile?.full_name?.toLowerCase().includes(query),
        )
    }, [leads, search])
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const current = Math.min(page, pages - 1)
    const shown = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

    return (
        <>
            <div className="mb-3 flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id={headingId} className="text-base font-semibold text-foreground">Leads</h2>
                {summary && <p className="text-sm tabular-nums text-muted-foreground">{summary}</p>}
            </div>
            <div className="overflow-hidden rounded-xl border bg-card">
                {leads.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">No leads yet. A lead that names this contact as its contact person shows here.</p>
                ) : (
                    <>
                        {leads.length > PAGE_SIZE && (
                            <div className="border-b p-3 sm:px-5">
                                <SearchField
                                    value={search}
                                    onChange={onSearch}
                                    aria-label="Search leads"
                                    placeholder="Search leads or PIC sales"
                                    className="md:max-w-xs"
                                />
                            </div>
                        )}
                        {shown.length === 0 ? (
                            <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">No leads match “{search.trim()}”.</p>
                        ) : (
                            <>
                                {/* A table from md. */}
                                <table className="w-full table-fixed text-left text-sm max-md:hidden">
                                    <colgroup>
                                        <col />
                                        <col className="w-36" />
                                        <col className="w-40" />
                                        <col className="w-36" />
                                        <col className="w-32" />
                                    </colgroup>
                                    <thead className="bg-muted">
                                        <tr className="h-10 text-sm font-medium text-muted-foreground">
                                            <th scope="col" className="px-5 font-medium">Project</th>
                                            <th scope="col" className="px-3 text-right font-medium">Estimated value</th>
                                            <th scope="col" className="px-3 font-medium">Stage</th>
                                            <th scope="col" className="px-3 font-medium">PIC sales</th>
                                            <th scope="col" className="px-3 font-medium">Target close</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {shown.map((lead) => (
                                            <tr key={lead.id} onClick={rowLink(`/leads/${lead.id}`)} className="h-13 cursor-pointer transition-colors hover:bg-muted/60">
                                                <td className="truncate px-5">
                                                    <Link href={`/leads/${lead.id}`} className="font-medium text-foreground hover:text-primary hover:underline" title={lead.project_name || "Untitled lead"}>
                                                        {lead.project_name || "Untitled lead"}
                                                    </Link>
                                                </td>
                                                <td className="truncate px-3 text-right tabular-nums">{lead.estimated_value ? fmt(lead.estimated_value) : <span className="text-muted-foreground">—</span>}</td>
                                                <td className="px-3"><StageChip stage={lead.pipeline_stage} /></td>
                                                <td className="truncate px-3" title={lead.pic_sales_profile?.full_name}>{lead.pic_sales_profile?.full_name ?? <span className="text-muted-foreground">—</span>}</td>
                                                <td className="truncate px-3 tabular-nums">{formatCalendarDay(lead.target_close_date) ?? <span className="text-muted-foreground">—</span>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* One row per lead on a phone. */}
                                <ul className="divide-y md:hidden">
                                    {shown.map((lead) => {
                                        const value = lead.estimated_value ? fmtAxis(lead.estimated_value) : null
                                        const closing = formatCalendarDay(lead.target_close_date)
                                        return (
                                            <li key={lead.id} onClick={rowLink(`/leads/${lead.id}`)} className="cursor-pointer px-4 py-3 transition-colors hover:bg-muted/60">
                                                <Link href={`/leads/${lead.id}`} className="block truncate text-sm font-medium text-foreground">
                                                    {lead.project_name || "Untitled lead"}
                                                </Link>
                                                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                                    <StageChip stage={lead.pipeline_stage} />
                                                    {value && <span className="font-medium tabular-nums text-foreground">{value}</span>}
                                                    {closing && <span className="tabular-nums">Closing {closing}</span>}
                                                </div>
                                                <p className="mt-1 truncate text-xs text-muted-foreground">{lead.pic_sales_profile?.full_name ?? "No PIC sales"}</p>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </>
                        )}
                        {filtered.length > PAGE_SIZE && (
                            <div className="flex h-12 items-center justify-end gap-2 border-t px-3 sm:px-5">
                                <span className="mr-2 text-xs tabular-nums text-muted-foreground">
                                    {current * PAGE_SIZE + 1}–{Math.min(filtered.length, (current + 1) * PAGE_SIZE)} of {filtered.length}
                                </span>
                                <Button variant="ghost" size="icon-sm" aria-label="Previous leads" disabled={current === 0} onClick={() => setPage(current - 1)} className="pointer-coarse:size-10">
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon-sm" aria-label="Next leads" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="pointer-coarse:size-10">
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    )
}
