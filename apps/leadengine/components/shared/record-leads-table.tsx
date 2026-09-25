"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { SearchField } from "@/components/shared/search-field"
import { ChevronLeft, ChevronRight, Plus } from "@/components/icons"
import { useCurrency } from "@/contexts/currency-context"
import { useRowLink } from "@/hooks/use-row-link"
import { formatCalendarDay, leadSummaryLabel, summarizeLeads } from "@/lib/record-page"
import { OUTLINED_BUTTON, RecordCard, StageChip, type RecordLead } from "./record-page"

const PAGE_SIZE = 10

/**
 * A record's Leads tab: one card titled Leads with New lead at its
 * trailing edge (for whoever may create one), the line "2 open · Rp 1.2B ·
 * 1 won", then the leads ten at a time: a table from `md` (the Data
 * table's sentence-case headers at the body's size, 52dp rows, the row
 * opening its lead), one row per lead with its stage, value and closing
 * day under the name on a phone. The search appears once there is more
 * than a page of them.
 */
export function RecordLeadsTable({ leads, onNew, emptyText }: {
    leads: readonly RecordLead[]
    onNew?: () => void
    emptyText: string
}) {
    const { fmt, fmtAxis } = useCurrency()
    const rowLink = useRowLink()
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(0)
    const onSearch = useCallback((value: string) => { setSearch(value); setPage(0) }, [])

    const summary = useMemo(() => leadSummaryLabel(summarizeLeads(leads), fmtAxis), [leads, fmtAxis])
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
        <RecordCard
            title="Leads"
            headingId="leads-tab-heading"
            action={onNew ? (
                <Button variant="outline" onClick={onNew} className={`${OUTLINED_BUTTON} -my-1.5 max-lg:h-10`}>
                    <Plus className="h-4 w-4" aria-hidden="true" /> New lead
                </Button>
            ) : undefined}
        >
            {leads.length === 0 ? (
                <p className="px-4 py-5 text-[13px] text-muted-foreground">{emptyText}</p>
            ) : (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        {summary && <p className="text-[13px] font-medium tabular-nums text-muted-foreground">{summary}</p>}
                        {leads.length > PAGE_SIZE && (
                            <SearchField value={search} onChange={onSearch} aria-label="Search leads" placeholder="Search leads or PIC sales" className="w-full md:max-w-xs" />
                        )}
                    </div>
                    {shown.length === 0 ? (
                        <p className="border-t border-border px-4 py-5 text-[13px] text-muted-foreground">No leads match “{search.trim()}”.</p>
                    ) : (
                        <>
                            {/* A table from md. */}
                            <table className="w-full table-fixed border-t border-border text-left text-sm max-md:hidden">
                                <colgroup>
                                    <col />
                                    <col className="w-36" />
                                    <col className="w-40" />
                                    <col className="w-40" />
                                    <col className="w-32" />
                                </colgroup>
                                <thead className="bg-muted">
                                    <tr className="h-10 text-sm text-muted-foreground">
                                        <th scope="col" className="px-4 font-medium">Project</th>
                                        <th scope="col" className="px-3 text-right font-medium">Estimated value</th>
                                        <th scope="col" className="px-3 font-medium">Stage</th>
                                        <th scope="col" className="px-3 font-medium">PIC sales</th>
                                        <th scope="col" className="px-3 font-medium">Target close</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {shown.map((lead) => (
                                        <tr key={lead.id} onClick={rowLink(`/leads/${lead.id}`)} className="h-13 cursor-pointer transition-colors hover:bg-muted/60">
                                            <td className="truncate px-4">
                                                <Link href={`/leads/${lead.id}`} className="font-semibold text-foreground hover:text-primary hover:underline" title={lead.project_name || "Untitled lead"}>
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
                            <ul className="divide-y divide-border border-t border-border md:hidden">
                                {shown.map((lead) => {
                                    const value = lead.estimated_value ? fmtAxis(lead.estimated_value) : null
                                    const closing = formatCalendarDay(lead.target_close_date)
                                    return (
                                        <li key={lead.id} onClick={rowLink(`/leads/${lead.id}`)} className="cursor-pointer px-4 py-3 transition-colors hover:bg-muted/60">
                                            <Link href={`/leads/${lead.id}`} className="block truncate text-sm font-semibold text-foreground">
                                                {lead.project_name || "Untitled lead"}
                                            </Link>
                                            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
                                                <StageChip stage={lead.pipeline_stage} />
                                                {value && <span className="font-medium tabular-nums text-foreground">{value}</span>}
                                                {closing && <span className="tabular-nums">Closing {closing}</span>}
                                            </div>
                                            <p className="mt-1 truncate text-[13px] text-muted-foreground">{lead.pic_sales_profile?.full_name ?? "No PIC sales"}</p>
                                        </li>
                                    )
                                })}
                            </ul>
                        </>
                    )}
                    {filtered.length > PAGE_SIZE && (
                        <div className="flex h-12 items-center justify-end gap-2 border-t border-border px-3">
                            <span className="mr-2 text-xs tabular-nums text-muted-foreground">
                                {current * PAGE_SIZE + 1}–{Math.min(filtered.length, (current + 1) * PAGE_SIZE)} of {filtered.length}
                            </span>
                            <Button variant="ghost" size="icon-sm" aria-label="Previous leads" disabled={current === 0} onClick={() => setPage(current - 1)} className="hover:bg-muted pointer-coarse:size-10">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" aria-label="Next leads" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="hover:bg-muted pointer-coarse:size-10">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </>
            )}
        </RecordCard>
    )
}
