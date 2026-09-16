import Link from "next/link"
import { ArrowLeft, Check, ClipboardList, HelpCircle, Plus } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { JOIN_STATUS_LABELS, type JoinStatus } from "@/lib/missions/mission-join"
import {
  DATE_PRESET_LABELS,
  availableMissionFilters,
  type MissionFilter,
} from "@/lib/missions/mission-filter"
import type { ConfirmationPolicy } from "@/lib/missions/assignment-workflow"
import { statusLabel } from "@/lib/missions/status-labels"
import { paths } from "@/lib/paths"
import { PageChrome } from "@/components/page-chrome"
import { Fab, type FabHint } from "@/components/fab"
import { ViewLink } from "@/components/remember-view"
import { hasMe, isPlainView, plainView, QUICK_DATES, toggleDate, toggleLens, toggleMe, viewParams, type QuickView } from "@/lib/missions/quick-filters"
import type { MissionSort } from "@/lib/missions/mission-paging"

/**
 * Shared page furniture, matching LeadEngine's list-page language: same
 * container padding, same header typography, same table and button primitives.
 */

/**
 * On a phone the title lives in the top app bar (announced through
 * PageChrome), the one primary action is an extended FAB, and the rest of
 * the header row wraps. From `lg` up the header is the page's own.
 */
export function WorkspacePage({
  eyebrow,
  title,
  description,
  action,
  primaryAction,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
  /** The screen's one primary action: a FAB on a phone, a filled button on a desk. */
  primaryAction?: { href: string; label: string; hint?: FabHint }
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full w-full flex-col overflow-clip bg-background">
      <PageChrome title={title} />
      {(eyebrow || description || action || primaryAction) && (
        <div className="shrink-0 px-4 pb-3 pt-3 sm:px-6 lg:px-8 lg:pb-4 lg:pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              {eyebrow && <p className="mb-1 hidden text-[11px] font-bold uppercase tracking-widest text-muted-foreground lg:block">{eyebrow}</p>}
              <h1 className="hidden text-xl font-semibold tracking-tight text-foreground lg:block">{title}</h1>
              {description && <p className="text-sm text-muted-foreground lg:mt-1">{description}</p>}
            </div>
            {(action || primaryAction) && (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {action}
                {primaryAction && (
                  <Button asChild size="sm" className="hidden lg:inline-flex">
                    <Link href={primaryAction.href}>
                      <Plus className="h-4 w-4" /> {primaryAction.label}
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <div id="page-scroll" className="custom-scrollbar flex-1 overflow-y-auto px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pb-8">
        {children}
      </div>
      {primaryAction && <Fab href={primaryAction.href} label={primaryAction.label} hint={primaryAction.hint} />}
    </div>
  )
}

/**
 * An empty state that teaches: what this list is, in one sentence, then
 * one to three steps that fill it, then the first step as a button and
 * "Pelajari" into the guide. This is where a first-time user learns the
 * product (Notion, Linear, Figma), not from a tour.
 */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = ClipboardList,
  steps,
  learnHref,
}: {
  title: string
  description: string
  action?: React.ReactNode
  icon?: typeof ClipboardList
  /** One to three short steps, numbered. */
  steps?: string[]
  /** The guide section that explains this part of the product. */
  learnHref?: string
}) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center sm:py-16" role="status">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {steps && steps.length > 0 && (
        <ol className="mt-5 w-full max-w-sm space-y-2.5 text-left">
          {steps.map((step, index) => (
            <li key={index} className="flex items-start gap-3 text-sm leading-relaxed text-foreground">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
      {(action || learnHref) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {action}
          {learnHref && (
            <Link href={learnHref} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              <HelpCircle className="h-4 w-4" aria-hidden="true" /> Pelajari
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Status is a label, not a control.
 *
 * It used to be an uppercase, wide-tracked pill, the same shape the list also
 * used for "Perlu jawaban Anda" (a demand) and "Kamu ditugaskan" (a position),
 * so nothing told the reader which of the three could be pressed. None could.
 * Material keeps a passive status as quiet text: sentence case, no container,
 * a colour dot to carry the state for a fast scan. The dot's colour clears
 * WCAG 1.4.11 against the card; the words carry the meaning for anyone who
 * cannot see it. Actions are buttons and live in the Aksi column.
 */
const STATUS_DOT: Record<string, string> = {
  ACCEPTED: "bg-[var(--success-foreground)]",
  COMPLETED: "bg-[var(--success-foreground)]",
  SUBMITTED: "bg-[var(--success-foreground)]",
  IN_PROGRESS: "bg-primary",
  SCHEDULED: "bg-primary",
  ASSIGNED: "bg-[var(--warning-foreground)]",
  PENDING: "bg-[var(--warning-foreground)]",
  RESCHEDULE_REQUESTED: "bg-[var(--warning-foreground)]",
  NEEDS_CLARIFICATION: "bg-[var(--warning-foreground)]",
  REJECTED: "bg-[var(--danger-foreground)]",
  CANCELLED: "bg-[var(--danger-foreground)]",
  DRAFT: "bg-muted-foreground",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-foreground">
      <span
        aria-hidden="true"
        className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[status] ?? "bg-muted-foreground")}
      />
      {statusLabel(status)}
    </span>
  )
}

/**
 * Where this viewer stands on a mission, as one quiet line under the status.
 *
 * Was a third pill in the row. Now it is supporting text: "Kamu di tim ini"
 * or "Bentrok dengan jadwalmu" is context, and "Bisa join" is an action, so
 * the latter becomes a Join button in the Aksi column and is not repeated as
 * text.
 */
export function JoinStatusLine({ status }: { status: JoinStatus }) {
  // Joinable becomes the button; over is already said by the status itself.
  if (status === "JOINABLE" || status === "OVER") return null
  return (
    <span
      className={cn(
        "block text-xs",
        status === "CONFLICT" ? "text-[var(--danger-foreground)]" : "text-muted-foreground"
      )}
    >
      {JOIN_STATUS_LABELS[status]}
    </span>
  )
}

/** Short forms of the answer lenses, for a chip beside "Hari ini". */
const QUICK_LENS_LABELS: Record<Exclude<MissionFilter, "all">, string> = {
  mine: "Butuh jawaban",
  team: "Menunggu tim",
}

/**
 * The chips above the activity list (M3 filter chips): the narrowings a
 * person reaches for every day, one tap each, outside the Filter sheet.
 * Every chip keeps the rest of the query, and every tap is remembered as
 * the list's view (`ViewLink`). One row that scrolls sideways on a phone
 * and wraps from `sm` up.
 */
export function QuickFilterChips({
  view,
  counts,
  policy,
  defaultSort,
}: {
  view: QuickView
  counts: Record<MissionFilter, number>
  policy: ConfirmationPolicy
  defaultSort: MissionSort
}) {
  const lenses = availableMissionFilters(policy).filter((lens): lens is Exclude<MissionFilter, "all"> => lens !== "all")
  const href = (next: QuickView) => paths.activities(viewParams(next, defaultSort))
  const chips: { key: string; label: string; active: boolean; href: string; count?: number }[] = [
    { key: "all", label: "Semua", active: isPlainView(view), href: href(plainView(view)) },
    ...QUICK_DATES.map((preset) => ({ key: preset, label: DATE_PRESET_LABELS[preset], active: view.query.date === preset, href: href(toggleDate(view, preset)) })),
    { key: "me", label: "Saya", active: hasMe(view.query), href: href(toggleMe(view)) },
    ...lenses.map((lens) => ({ key: lens, label: QUICK_LENS_LABELS[lens], active: view.lens === lens, href: href(toggleLens(view, lens)), count: counts[lens] })),
  ]

  return (
    <nav
      aria-label="Saringan cepat"
      className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((chip) => (
        <ViewLink
          key={chip.key}
          list="activities"
          href={chip.href}
          aria-pressed={chip.active}
          className={cn(
            // M3 filter chip: 32dp, 8dp corners, tonal with a leading check
            // when selected. The 48dp tap target on a phone comes from the
            // pseudo-element.
            "relative inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm transition-colors after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']",
            chip.active
              ? "border-transparent bg-[var(--tonal)] font-medium text-[var(--tonal-foreground)]"
              : "border-input bg-transparent text-foreground hover:bg-muted"
          )}
        >
          {chip.active && <Check className="h-4 w-4" aria-hidden="true" />}
          {chip.label}
          {chip.count !== undefined && (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                chip.active ? "bg-[var(--tonal-foreground)]/10" : "bg-muted text-muted-foreground"
              )}
            >
              {chip.count}
            </span>
          )}
        </ViewLink>
      ))}
    </nav>
  )
}

export function NewMissionAction() {
  return (
    <Button asChild size="sm">
      <Link href={paths.newActivity()}>
        <Plus className="h-4 w-4" /> Aktivitas baru
      </Link>
    </Button>
  )
}

/** Kembali: a button on a desk; on a phone the top app bar's back arrow. */
export function BackLink({ href = paths.activities() }: { href?: string }) {
  return (
    <>
      <PageChrome backHref={href} />
      <Button asChild variant="outline" size="sm" className="hidden lg:inline-flex">
        <Link href={href}>
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
      </Button>
    </>
  )
}

