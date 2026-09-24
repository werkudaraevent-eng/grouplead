"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react"
import { ChevronsRight, MoreVertical, Pencil, Trash2 } from "@/components/icons"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InitialsAvatar } from "@/components/shared/initials-avatar"
import { useCurrency } from "@/contexts/currency-context"
import { usePermissions } from "@/contexts/permissions-context"
import { useEdgeFade } from "@/hooks/use-edge-fade"
import { useRowLink } from "@/hooks/use-row-link"
import { EDGE_FADE_PX } from "@/lib/ui/edge-fade"
import { shortPersonName } from "@/lib/person-name"
import { cn } from "@/lib/utils"
import type { Lead, PipelineStage, TransitionRule } from "@/types"
import { useKanbanCardConfig } from "@/features/leads/hooks/use-kanban-card-config"
import { useStageMove, type LeadStageChange } from "@/features/leads/hooks/use-stage-move"
import {
    dateFactWord,
    formatDay,
    leadChips,
    leadDateFact,
    leadInStage,
    localDayKey,
    readStageParam,
    resolveStageId,
    scrollLeftToCenter,
    stageCountLabel,
    stageOutcome,
    summarizeStages,
    withStageParam,
    type ChipTone,
    type LeadDateFact,
} from "@/features/leads/lib/pipeline-phone"
import { SheetChoice } from "./sheet-choice"

/**
 * The Pipeline on a phone (below `md`), where a desk has the kanban board:
 * the pipeline's stages as a row of M3 primary tabs pinned under the top
 * app bar, and under them the chosen stage's leads as a list of cards
 * (Pipedrive's mobile pipeline; M3 has no phone kanban and gives a phone
 * lists and tabs). No dragging: a card's ⋮ has "Move to stage…", a
 * bottom sheet of the stages, which moves the lead the way a drop on the
 * board does (`useStageMove`: the same rules, prompts and server action).
 *
 * Each tab says its stage, how many leads are in it and what they add up
 * to; the counts follow the search and filters, as the board's columns do.
 * The stage in view is kept in the address (`?stage=`), replaced rather
 * than pushed, so Back from a lead and a reload come back to it; with none
 * chosen the page opens on the first open stage with leads in it, and
 * keeps that stage while leads move or a search narrows the list.
 */
export function PipelinePhoneView({
    leads: initialLeads,
    loading,
    stages,
    transitionRules,
    narrowed,
    toolbar,
    sortControl,
    onQuickEdit,
    onDeleteLead,
    onLeadStageChange,
}: {
    /** Every lead of the pipeline the search and filters let through, in the chosen order. */
    leads: Lead[]
    loading: boolean
    /** The pipeline's stages in the board's order (`sortStages`). */
    stages: PipelineStage[]
    transitionRules: TransitionRule[]
    /** A search or filter narrows the leads (for the empty stage's words). */
    narrowed: boolean
    /** The search and the filters, under the tabs. */
    toolbar: ReactNode
    /** The sort menu, at the end of the count's row. */
    sortControl: ReactNode
    onQuickEdit: (lead: Lead) => void
    onDeleteLead: (leadId: number) => void
    onLeadStageChange: LeadStageChange
}) {
    const { can } = usePermissions()
    const canMoveLeads = can("leads", "update")
    const canEditLeads = can("leads", "update")
    const canDeleteLeads = can("leads", "delete")
    const { fmtAxis } = useCurrency()
    const { config, loaded: configLoaded } = useKanbanCardConfig()
    const rowLink = useRowLink()

    // The board's pattern: a copy that moves ahead of the server, and the
    // page's list to fall back to.
    const [leads, setLeads] = useState<Lead[]>(initialLeads)
    useEffect(() => { setLeads(initialLeads) }, [initialLeads])

    const { moveToStage, dialogs } = useStageMove({
        leads,
        initialLeads,
        setLeads,
        stages,
        transitionRules,
        canMoveLeads,
        onLeadStageChange,
    })

    const summaries = useMemo(() => summarizeStages(stages, leads), [stages, leads])
    const busy = loading || !configLoaded

    // The stage in view. Starts from the address; once the leads are in, a
    // missing or foreign `?stage=` gives way to the default, which is then
    // held, so the tab never jumps under the reader as counts change.
    const [chosen, setChosen] = useState<string | null>(() =>
        typeof window === "undefined" ? null : readStageParam(window.location.search),
    )
    const chosenValid = chosen !== null && stages.some((stage) => stage.id === chosen)
    const activeId = chosenValid ? chosen : busy ? null : resolveStageId(stages, null, summaries)
    const activeStage = stages.find((stage) => stage.id === activeId) ?? null

    useEffect(() => {
        if (busy || chosenValid || !activeId) return
        if (chosen !== null) writeStageParam(null)
        setChosen(activeId)
    }, [busy, chosenValid, activeId, chosen])

    // The pinned bar (its height) and, inside it, the row of tabs that
    // scrolls sideways and fades at each edge it can still scroll toward.
    const barRef = useRef<HTMLDivElement>(null)
    const rowRef = useRef<HTMLDivElement>(null)
    const rowFade = useEdgeFade(rowRef)
    const countRef = useRef<HTMLDivElement>(null)

    const choose = useCallback((stageId: string) => {
        setChosen(stageId)
        writeStageParam(stageId)
        // A new stage's list starts at its top: when the page has been read
        // past the count, bring the count back to just under the tabs.
        const main = document.getElementById("main-content")
        const bar = barRef.current
        const count = countRef.current
        if (!main || !bar || !count) return
        const top = count.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - bar.offsetHeight
        if (main.scrollTop > top) main.scrollTo({ top })
    }, [])

    // The tab in view stands in the middle of its row, clear of the edge
    // fades, with some of its neighbours showing. Only the row moves (its
    // own scrollLeft), never the page: no scrollIntoView.
    const placed = useRef(false)
    useEffect(() => {
        const row = rowRef.current
        if (!row || !activeId) return
        const tab = row.querySelector<HTMLElement>(`[data-stage-id="${CSS.escape(activeId)}"]`)
        if (!tab) return
        const left = scrollLeftToCenter({
            itemLeft: tab.offsetLeft,
            itemWidth: tab.offsetWidth,
            viewWidth: row.clientWidth,
            scrollWidth: row.scrollWidth,
            fade: EDGE_FADE_PX,
        })
        const smooth = placed.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        row.scrollTo({ left, behavior: smooth ? "smooth" : "auto" })
        placed.current = true
    }, [activeId, stages.length])

    // Arrow keys, Home and End move between tabs and choose (WAI-ARIA tabs,
    // automatic activation), the focus following without a page scroll.
    const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!activeId || stages.length === 0) return
        const index = stages.findIndex((stage) => stage.id === activeId)
        const next =
            event.key === "ArrowRight" ? Math.min(stages.length - 1, index + 1)
            : event.key === "ArrowLeft" ? Math.max(0, index - 1)
            : event.key === "Home" ? 0
            : event.key === "End" ? stages.length - 1
            : null
        if (next === null) return
        event.preventDefault()
        const target = stages[next]
        choose(target.id)
        rowRef.current?.querySelector<HTMLElement>(`[data-stage-id="${CSS.escape(target.id)}"]`)?.focus({ preventScroll: true })
    }

    const inStage = useMemo(
        () => (activeStage ? leads.filter((lead) => leadInStage(lead, activeStage)) : []),
        [leads, activeStage],
    )
    const today = localDayKey(new Date())
    const [moving, setMoving] = useState<Lead | null>(null)

    const hasMenu = (canMoveLeads && stages.length > 1) || canEditLeads || canDeleteLeads

    return (
        <>
            {/* M3 primary tabs, scrollable, flush under the top app bar and
                pinned there: they name the stage in view and are the way to
                the others. Opaque, with the hairline under them; the bar
                carries both, because the row inside it is masked at its
                edges (`edge-fade`) and a mask would let the cards show
                through the surface there. */}
            {busy && !activeId ? (
                <div className="sticky top-0 z-20 flex h-[49px] items-center gap-6 border-b border-border bg-background px-4" aria-hidden="true">
                    {[88, 112, 96, 80].map((width) => (
                        <span key={width} className="flex flex-col gap-1.5">
                            <span className="block h-3 animate-pulse rounded bg-muted" style={{ width }} />
                            <span className="block h-2.5 w-10 animate-pulse rounded bg-muted" />
                        </span>
                    ))}
                </div>
            ) : stages.length > 0 ? (
                <div ref={barRef} className="sticky top-0 z-20 border-b border-border bg-background">
                    <div
                        ref={rowFade}
                        role="tablist"
                        aria-label="Stages"
                        onKeyDown={onTabKey}
                        className="edge-fade no-scrollbar relative flex overflow-x-auto"
                    >
                        {stages.map((stage) => {
                            const summary = summaries.get(stage.id) ?? { count: 0, total: 0 }
                            const active = stage.id === activeId
                            const facts = `${summary.count.toLocaleString("en-US")}${summary.total > 0 ? ` · ${fmtAxis(summary.total)}` : ""}`
                            return (
                                <button
                                    key={stage.id}
                                    id={`stage-tab-${stage.id}`}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    aria-controls="pipeline-stage-panel"
                                    aria-label={`${stage.name}, ${summary.count} ${summary.count === 1 ? "lead" : "leads"}${summary.total > 0 ? `, ${fmtAxis(summary.total)}` : ""}`}
                                    tabIndex={active ? 0 : -1}
                                    data-stage-id={stage.id}
                                    onClick={() => choose(stage.id)}
                                    className={cn(
                                        "relative flex h-12 shrink-0 flex-col items-center justify-center px-4 transition-colors",
                                        active
                                            ? "text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-primary"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                    )}
                                >
                                    <span className="max-w-[12rem] truncate text-sm font-medium leading-5">{stage.name}</span>
                                    <span className="text-xs leading-4 tabular-nums">{facts}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            ) : null}

            {toolbar}

            {/* What the list below counts, and in what order. */}
            <div ref={countRef} className="flex min-h-10 items-center justify-between gap-3 px-4 pt-3">
                <p className="min-w-0 truncate text-xs font-medium tabular-nums text-muted-foreground" aria-live="polite">
                    {busy ? "Loading…" : activeStage ? stageCountLabel(activeStage.name, inStage.length, leads.length) : null}
                </p>
                {sortControl}
            </div>

            <div
                id="pipeline-stage-panel"
                role={activeId ? "tabpanel" : undefined}
                aria-labelledby={activeId ? `stage-tab-${activeId}` : undefined}
                className="px-4 pt-3 pb-3"
            >
                {busy ? (
                    <LeadCardSkeleton />
                ) : stages.length === 0 ? (
                    <PhoneEmpty title="This pipeline has no stages" description="Its stages are set up under Manage stages, in the ⋮ at the top." />
                ) : inStage.length === 0 ? (
                    <PhoneEmpty
                        title={narrowed && leads.length === 0 ? "No leads match" : `No leads in ${activeStage?.name ?? "this stage"}`}
                        description={
                            narrowed
                                ? leads.length > 0
                                    ? `${leads.length.toLocaleString("en-US")} ${leads.length === 1 ? "lead matches" : "leads match"} in other stages.`
                                    : "Try another search, or clear the filters."
                                : "Leads moved to this stage show up here."
                        }
                    />
                ) : (
                    <ul className="space-y-3">
                        {inStage.map((lead) => (
                            <PipelineLeadCard
                                key={lead.id}
                                lead={lead}
                                stage={activeStage}
                                badges={config.badges}
                                today={today}
                                onOpen={rowLink(`/leads/${lead.id}`)}
                                menu={
                                    hasMenu ? (
                                        <LeadCardMenu
                                            lead={lead}
                                            // The board's rule: a lead from before stage ids has nothing to move from.
                                            onMove={canMoveLeads && stages.length > 1 && lead.pipeline_stage_id ? () => setMoving(lead) : undefined}
                                            onEdit={canEditLeads ? () => onQuickEdit(lead) : undefined}
                                            onDelete={canDeleteLeads ? () => onDeleteLead(lead.id) : undefined}
                                        />
                                    ) : null
                                }
                            />
                        ))}
                    </ul>
                )}
            </div>

            {/* "Move to stage…": the pipeline's stages, the lead's own checked. */}
            <BottomSheet
                open={moving !== null}
                onOpenChange={(open) => { if (!open) setMoving(null) }}
                title="Move to stage"
                description={moving ? leadName(moving) : undefined}
            >
                <div role="radiogroup" aria-label="Stages" className="space-y-1 px-2 pb-2">
                    {moving && stages.map((stage) => {
                        const current = leadInStage(moving, stage)
                        return (
                            <SheetChoice
                                key={stage.id}
                                label={stage.name}
                                hint={outcomeHint(stage)}
                                checked={current}
                                onChoose={() => {
                                    const lead = moving
                                    setMoving(null)
                                    if (!current) moveToStage(lead, stage)
                                }}
                            />
                        )
                    })}
                </div>
            </BottomSheet>

            {dialogs}
        </>
    )
}

/** Replace `?stage=` in the address without a navigation or a scroll. */
function writeStageParam(stageId: string | null) {
    const query = withStageParam(window.location.search, stageId)
    const path = window.location.pathname
    // `null` state, as the Next.js docs ask: the router keeps its own entry
    // and `useSearchParams` follows (see `useListUrl`).
    window.history.replaceState(null, "", query ? `${path}?${query}` : path)
}

function leadName(lead: Lead): string {
    return lead.project_name || lead.client_company?.name || "Untitled"
}

function outcomeHint(stage: PipelineStage): string | undefined {
    switch (stageOutcome(stage)) {
        case "won":
            return "Closed as won"
        case "lost":
            return "Closed as lost"
        case "closed":
            return "Closed"
        default:
            return undefined
    }
}

/** Chip tones as tokens (M3 tonal containers), never a palette colour. */
const CHIP_TONE: Record<ChipTone, string> = {
    neutral: "bg-muted text-foreground",
    success: "bg-[var(--success)] text-[var(--success-foreground)]",
    warning: "bg-[var(--warning)] text-[var(--warning-foreground)]",
    danger: "bg-[var(--danger)] text-[var(--danger-foreground)]",
    info: "bg-primary/10 text-primary",
}

function dateTone(fact: LeadDateFact): string {
    if (fact.kind === "won") return "text-[var(--success-foreground)]"
    if (fact.kind === "closing" && fact.urgency === "overdue") return "font-medium text-[var(--danger-foreground)]"
    if (fact.kind === "closing" && fact.urgency === "soon") return "text-[var(--warning-foreground)]"
    if (fact.kind === "closing") return "text-foreground"
    return "text-muted-foreground"
}

/**
 * One lead on a phone, in Sales Activity's card anatomy (and Contacts'):
 *
 *   ┌──────────────────────────────────────────┐
 *   │ Project name                             │  headline, one line
 *   │ Client company                           │  12px, muted
 *   │ [WG Events] [A] [Hot]                    │  the Card Settings chips
 *   │ Rp 1,2 M · Closing 12 Sep 2026           │  value, then the date
 *   ├──────────────────────────────────────────┤  hairline
 *   │ (AB) PIC sales                         ⋮ │  who, then the actions
 *   └──────────────────────────────────────────┘
 *
 * The card opens the lead; the name is the real link, for the keyboard and
 * a new tab; the ⋮ never opens it.
 */
function PipelineLeadCard({
    lead,
    stage,
    badges,
    today,
    onOpen,
    menu,
}: {
    lead: Lead
    stage: PipelineStage | null
    badges: string[]
    today: string
    onOpen: (event: MouseEvent<HTMLElement>) => void
    menu: ReactNode
}) {
    const { fmtAxis } = useCurrency()
    const href = `/leads/${lead.id}`
    const chips = leadChips(lead, badges)
    const fact = leadDateFact(
        lead,
        {
            name: stage?.name ?? lead.pipeline_stage?.name ?? lead.status,
            closed_status: stage?.closed_status ?? lead.pipeline_stage?.closed_status,
            stage_type: stage?.stage_type ?? lead.pipeline_stage?.stage_type,
        },
        today,
    )
    const word = dateFactWord(fact)
    const dateText = word && fact.day ? `${word} ${formatDay(fact.day)}` : null
    const value = lead.estimated_value ? fmtAxis(lead.estimated_value) : null
    const pic = lead.pic_sales_profile

    return (
        <li onClick={onOpen} className="cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-muted/50">
            <div className="p-4">
                <Link href={href} prefetch={false} className="block truncate font-semibold text-foreground hover:underline">
                    {leadName(lead)}
                </Link>
                <p className="truncate text-xs text-muted-foreground">{lead.client_company?.name || "No client company"}</p>
                {chips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {chips.map((chip) => (
                            <span key={chip.key} className={cn("inline-flex h-6 min-w-0 max-w-full items-center rounded-md px-2 text-xs font-medium", CHIP_TONE[chip.tone])}>
                                <span className="truncate">{chip.label}</span>
                            </span>
                        ))}
                    </div>
                )}
                <p className="mt-2 truncate text-sm text-foreground">
                    {value || dateText ? (
                        <>
                            {value && <span className="font-medium tabular-nums">{value}</span>}
                            {value && dateText && <span className="text-muted-foreground"> · </span>}
                            {dateText && <span className={cn("tabular-nums", dateTone(fact))}>{dateText}</span>}
                        </>
                    ) : (
                        <span className="text-muted-foreground">No value or closing date</span>
                    )}
                </p>
            </div>
            {/* Who holds it at bottom-start, what to do at bottom-end (M3 card). */}
            <div className="flex min-h-11 items-center justify-between gap-3 border-t border-border px-3 py-2">
                {pic?.full_name ? (
                    <span className="flex min-w-0 items-center gap-2" title={pic.full_name}>
                        <span aria-hidden="true" className="shrink-0">
                            <InitialsAvatar name={pic.full_name} src={pic.avatar_url} size="sm" />
                        </span>
                        <span className="min-w-0 truncate text-xs font-medium text-foreground">
                            <span className="sr-only">PIC sales: </span>
                            {shortPersonName(pic.full_name)}
                        </span>
                    </span>
                ) : (
                    <span className="min-w-0 truncate text-xs text-muted-foreground">No PIC sales</span>
                )}
                {menu && <span className="flex shrink-0 items-center">{menu}</span>}
            </div>
        </li>
    )
}

/** The card's ⋮: what the board's card menus offer, less what needs a pointer. */
function LeadCardMenu({
    lead,
    onMove,
    onEdit,
    onDelete,
}: {
    lead: Lead
    onMove?: () => void
    onEdit?: () => void
    onDelete?: () => void
}) {
    if (!onMove && !onEdit && !onDelete) return null
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={`Actions for ${leadName(lead)}`}
                    className="-mr-1 grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <MoreVertical className="h-5 w-5" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52" collisionPadding={16}>
                {onMove && (
                    <DropdownMenuItem className="min-h-11" onSelect={onMove}>
                        <ChevronsRight className="h-4 w-4" /> Move to stage…
                    </DropdownMenuItem>
                )}
                {onEdit && (
                    <DropdownMenuItem className="min-h-11" onSelect={onEdit}>
                        <Pencil className="h-4 w-4" /> Edit
                    </DropdownMenuItem>
                )}
                {onDelete && (
                    <>
                        {(onMove || onEdit) && <DropdownMenuSeparator />}
                        <DropdownMenuItem className="min-h-11" variant="destructive" onSelect={onDelete}>
                            <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function PhoneEmpty({ title, description }: { title: string; description: string }) {
    return (
        <div className="mx-auto flex max-w-sm flex-col items-center justify-center py-16 text-center">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
    )
}

/** The cards while the leads load, drawn to the card's measurements. */
function LeadCardSkeleton() {
    return (
        <ul className="space-y-3" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
                <li key={i} className="overflow-hidden rounded-xl border border-border bg-card">
                    <span className="block p-4">
                        <span className="flex h-6 items-center">
                            <span className="block h-3.5 animate-pulse rounded bg-muted" style={{ width: `${55 + ((i * 13) % 30)}%` }} />
                        </span>
                        <span className="flex h-4 items-center">
                            <span className="block h-2.5 w-2/5 animate-pulse rounded bg-muted" />
                        </span>
                        <span className="mt-2 flex gap-1.5">
                            <span className="block h-6 w-16 animate-pulse rounded-md bg-muted" />
                            <span className="block h-6 w-8 animate-pulse rounded-md bg-muted" />
                        </span>
                        <span className="mt-2 flex h-5 items-center">
                            <span className="block h-3 w-1/2 animate-pulse rounded bg-muted" />
                        </span>
                    </span>
                    <span className="flex min-h-11 items-center justify-between gap-3 border-t border-border px-3 py-2">
                        <span className="flex items-center gap-2">
                            <span className="block h-7 w-7 animate-pulse rounded-full bg-muted" />
                            <span className="block h-2.5 w-20 animate-pulse rounded bg-muted" />
                        </span>
                    </span>
                </li>
            ))}
        </ul>
    )
}
