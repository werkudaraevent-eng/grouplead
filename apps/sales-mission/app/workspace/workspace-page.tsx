import Link from "next/link"
import { ArrowLeft, ClipboardList, HelpCircle, Plus } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { JOIN_STATUS_LABELS, type JoinStatus } from "@/lib/missions/mission-join"
import { statusLabel } from "@/lib/missions/status-labels"
import { paths } from "@/lib/paths"
import { PageChrome } from "@/components/page-chrome"
import { Fab, type FabHint } from "@/components/fab"
import { PageIntro } from "@/components/page-intro"

/**
 * Shared page furniture, matching LeadEngine's list-page language: same
 * container padding, same header typography, same table and button primitives.
 */

/**
 * One header for every page (DESIGN.md "Page headers"), the lists' own.
 *
 * From `lg` it is one 56dp row, level with the drawer's header, holding
 * the 20px title and the page's actions centred on it. A top-level page
 * has nothing above the title: the drawer's active item and the title
 * already say where you are, and the product's name is in the drawer. A
 * derived page (a settings page, a record, a form) may name its parent
 * in one small sentence-case line above the title, inside the same row
 * (`eyebrow`: "Pengaturan", "Aktivitas"), never the product's name. Under
 * the row, a description that teaches shows until the person closes it
 * (`introKey`); one that states facts (Hari ini's date, a record's type
 * and place) always shows.
 *
 * On a phone the title lives in the top app bar (announced through
 * PageChrome), the one primary action is an extended FAB, and the rest of
 * the header row wraps.
 */
export function WorkspacePage({
  eyebrow,
  title,
  description,
  introKey,
  phoneDescription = true,
  action,
  phoneAction = true,
  primaryAction,
  fill = false,
  children,
}: {
  /** A derived page's parent, in sentence case ("Pengaturan / AI"); a top-level page has none. */
  eyebrow?: string
  title: string
  description?: string
  /**
   * The description only teaches: show it until the person closes it, and
   * remember that on their account under this key (`listIntroKey`,
   * `pageIntroKey`). Without it the description states facts and stays.
   */
  introKey?: string
  /**
   * Whether the description also shows on a phone. A sentence that only
   * teaches what a coach mark already teaches costs two lines on every
   * visit there, before the first record; a description that states facts
   * (the record's type and place) earns them.
   */
  phoneDescription?: boolean
  action?: React.ReactNode
  /**
   * Whether `action` also shows on a phone. Secondary page actions (export,
   * import) belong in the top app bar's overflow there, announced by the
   * page through `PageChrome menu`; the desk keeps them in the header.
   */
  phoneAction?: boolean
  /** The screen's one primary action: a FAB on a phone, a filled button on a desk. */
  primaryAction?: { href: string; label: string; hint?: FabHint }
  /**
   * The page is one list whose table fills the window, from `md` up: the
   * content area becomes a column that ends at the window's foot, its rows
   * (saved views, chips, filters, the selection bar) keep their height, and
   * the table's card (`ListTableFrame`) takes the rest and scrolls inside
   * itself, so its header row, its footer and its sideways scrollbar stay in
   * view (M3 data table; Airtable, HubSpot, Sheets; LeadEngine's lists). The
   * area keeps its own scroller only as a fallback for a window too short
   * for the card's minimum. Below `md` the page scrolls as every page does.
   */
  fill?: boolean
  children: React.ReactNode
}) {
  // Whether anything in the header reaches a phone; if not, the block is
  // desk-only rather than an empty band of padding above the list.
  const phoneHeader = Boolean((description && phoneDescription) || (action && phoneAction))
  const actions = (action || primaryAction) && (
    <div className={cn("flex shrink-0 flex-wrap items-center gap-2", !phoneAction && "max-lg:hidden")}>
      {action}
      {primaryAction && (
        <Button asChild size="sm" className="hidden lg:inline-flex">
          <Link href={primaryAction.href}>
            <Plus className="h-4 w-4" /> {primaryAction.label}
          </Link>
        </Button>
      )}
    </div>
  )
  const text =
    description &&
    (introKey ? (
      <PageIntro hintKey={introKey} className={cn(!fill && "max-lg:order-first", !phoneDescription && "max-lg:hidden")}>
        {description}
      </PageIntro>
    ) : (
      <p data-page-intro="" className={cn("text-sm text-muted-foreground", !fill && "max-lg:order-first", !phoneDescription && "max-lg:hidden")}>
        {description}
      </p>
    ))
  return (
    <div className="flex h-full w-full flex-col overflow-clip bg-background">
      <PageChrome title={title} />
      {/* The row keeps its 56dp whether or not a parent line sits over the
          title; the description, while there is one, under it. On a phone
          a page other than a list reads its description before its
          actions, as it always has. */}
      <div
        className={cn(
          "shrink-0 px-4 pb-3 pt-3 sm:px-6 lg:px-8 lg:pb-0 lg:pt-0 lg:has-[[data-page-intro]]:pb-3",
          !fill && "max-lg:flex max-lg:flex-col max-lg:gap-3",
          !phoneHeader && "max-lg:hidden"
        )}
      >
        <div className="flex flex-col gap-3 lg:min-h-14 lg:flex-row lg:items-center lg:justify-between lg:py-1.5">
          <div className="hidden min-w-0 lg:block">
            {eyebrow && <p className="truncate text-xs font-medium text-muted-foreground">{eyebrow}</p>}
            <h1 className={cn("text-xl font-semibold tracking-tight text-foreground", fill && "truncate")}>{title}</h1>
          </div>
          {actions}
        </div>
        {text}
      </div>
      <div
        id="page-scroll"
        className={cn(
          "custom-scrollbar flex-1 overflow-y-auto px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pb-8",
          !phoneHeader && "max-lg:pt-3",
          // The list ends a small gutter above the window's foot, not 32px up.
          fill && "md:flex md:flex-col md:*:shrink-0 lg:pb-4",
          // A filled list ends at the window's foot, where its footer would
          // sit under the FAB between `md` and `lg`; stop above the FAB.
          fill && primaryAction && "md:max-lg:pb-[calc(10.5rem+env(safe-area-inset-bottom))]"
        )}
      >
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

/**
 * In a table cell it may be cut like any cell; beside a name that can run
 * long (a card's headline) pass `shrink-0`, so the name gives way and the
 * status is always read whole ("Diteri…" said nothing).
 */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-2 text-sm text-foreground", className)}>
      <span
        aria-hidden="true"
        className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[status] ?? "bg-muted-foreground")}
      />
      <span className="truncate">{statusLabel(status)}</span>
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

