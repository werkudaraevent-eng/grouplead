import Link from "next/link"
import { ArrowLeft, ClipboardList, Plus } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { JOIN_STATUS_LABELS, type JoinStatus } from "@/lib/missions/mission-join"
import {
  MISSION_FILTER_LABELS,
  availableMissionFilters,
  type MissionFilter,
} from "@/lib/missions/mission-filter"
import type { ConfirmationPolicy } from "@/lib/missions/assignment-workflow"
import { statusLabel } from "@/lib/missions/status-labels"

/**
 * Shared page furniture, matching LeadEngine's list-page language: same
 * container padding, same header typography, same table and button primitives.
 */

export function WorkspacePage({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full w-full flex-col overflow-clip bg-background">
      <div className="shrink-0 px-4 pb-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {eyebrow && <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{eyebrow}</p>}
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      </div>
      <div className="custom-scrollbar flex-1 overflow-y-auto px-4 pb-8 sm:px-6 lg:px-8">{children}</div>
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center" role="status">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground">
        <ClipboardList className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
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

export function MissionFilterChips({
  active,
  counts,
  policy,
}: {
  active: MissionFilter
  counts: Record<MissionFilter, number>
  policy: ConfirmationPolicy
}) {
  const filters = availableMissionFilters(policy)
  // One lens is no lens. With confirmation off there is nothing to narrow to.
  if (filters.length < 2) return null

  return (
    <nav aria-label="Saring mission" className="mb-4 flex flex-wrap gap-2">
      {filters.map((filter) => {
        const isActive = filter === active
        return (
          <Link
            key={filter}
            href={filter === "all" ? "/workspace/missions" : `/workspace/missions?filter=${filter}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              // min-h-11 keeps every chip at the 44px tap target on a phone,
              // where this row is thumb-operated.
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card text-foreground hover:bg-muted"
            )}
          >
            {MISSION_FILTER_LABELS[filter]}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                isActive ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
              )}
            >
              {counts[filter]}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

export function NewMissionAction() {
  return (
    <Button asChild size="sm">
      <Link href="/workspace/missions/new">
        <Plus className="h-4 w-4" /> Mission baru
      </Link>
    </Button>
  )
}

export function BackLink({ href = "/workspace/missions" }: { href?: string }) {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Link>
    </Button>
  )
}

