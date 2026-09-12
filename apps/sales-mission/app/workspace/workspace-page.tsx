import Link from "next/link"
import { ArrowLeft, ArrowUpRight, ClipboardList, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatMissionSchedule, type MissionListItem } from "@/lib/missions/mission-schema"
import { JOIN_STATUS_LABELS, type JoinStatus } from "@/lib/missions/mission-join"
import {
  MISSION_FILTERS,
  MISSION_FILTER_LABELS,
  isAwaitingTeam,
  needsMyAnswer,
  type MissionFilter,
} from "@/lib/missions/mission-filter"
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
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
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

/** Covers mission statuses, assignment responses, and report statuses alike. */
const STATUS_TONES: Record<string, string> = {
  ACCEPTED: "bg-[var(--success)] text-[var(--success-foreground)]",
  COMPLETED: "bg-[var(--success)] text-[var(--success-foreground)]",
  SUBMITTED: "bg-[var(--success)] text-[var(--success-foreground)]",
  SCHEDULED: "bg-secondary text-secondary-foreground",
  IN_PROGRESS: "bg-secondary text-secondary-foreground",
  ASSIGNED: "bg-[var(--warning)] text-[var(--warning-foreground)]",
  PENDING: "bg-[var(--warning)] text-[var(--warning-foreground)]",
  RESCHEDULE_REQUESTED: "bg-[var(--warning)] text-[var(--warning-foreground)]",
  NEEDS_CLARIFICATION: "bg-[var(--warning)] text-[var(--warning-foreground)]",
  DRAFT: "bg-muted text-muted-foreground",
  REJECTED: "bg-[var(--danger)] text-[var(--danger-foreground)]",
  CANCELLED: "bg-[var(--danger)] text-[var(--danger-foreground)]",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        STATUS_TONES[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {statusLabel(status)}
    </span>
  )
}

const JOIN_TONES: Record<JoinStatus, string> = {
  ASSIGNED: "bg-secondary text-secondary-foreground",
  CONFLICT: "bg-[var(--danger)] text-[var(--danger-foreground)]",
  JOINABLE: "bg-[var(--success)] text-[var(--success-foreground)]",
  FULL: "bg-muted text-muted-foreground",
  CLOSED: "bg-muted text-muted-foreground",
}

/**
 * Where this viewer stands on a mission. Colour carries the meaning at a
 * glance, and the label repeats it so the chip is not colour-only.
 */
export function JoinStatusChip({ status }: { status: JoinStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", JOIN_TONES[status])}>
      {JOIN_STATUS_LABELS[status]}
    </span>
  )
}

/**
 * Where a mission's answers stand, from the reader's own point of view first.
 *
 * "Perlu jawaban Anda" outranks the team count because it is the only line here
 * that asks the reader to do something. The count that follows is what the
 * deleted Penugasan screen existed to show, now attached to the mission it is
 * about instead of to a row per person.
 *
 * The last two branches split on `isAwaitingTeam` rather than on the raw count,
 * because the same number means two different things. On a mission that can
 * still be answered it is a chase list; on one that is finished or cancelled
 * nobody will ever answer, so the same "belum jawab" would nag about a visit
 * that already happened — and it would also disagree with the chip above, which
 * counts through the same gate. Reporting it in the past tense keeps the record
 * (there is no per-person screen left to find it on) without asking for
 * anything.
 */
function AnswerCell({ mission }: { mission: MissionListItem }) {
  if (needsMyAnswer(mission)) {
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--warning)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--warning-foreground)]">
        Perlu jawaban Anda
      </span>
    )
  }

  const teamSize = mission.supportingCount + (mission.primarySalesName ? 1 : 0)
  if (teamSize === 0) return <span className="text-sm text-muted-foreground">Belum ada tim</span>

  if (isAwaitingTeam(mission)) {
    return (
      <span className="text-sm font-medium text-foreground">
        {mission.pendingResponses} belum jawab
      </span>
    )
  }

  if (mission.pendingResponses > 0) {
    return (
      <span className="text-sm text-muted-foreground">
        {mission.pendingResponses} tidak menjawab
      </span>
    )
  }

  return <span className="text-sm text-muted-foreground">Lengkap</span>
}

/**
 * Lenses over the same list, as links rather than a client-side control: the
 * chosen lens belongs in the URL so it survives a reload and can be shared with
 * the admin who is chasing the same answers.
 */
export function MissionFilterChips({
  active,
  counts,
}: {
  active: MissionFilter
  counts: Record<MissionFilter, number>
}) {
  return (
    <nav aria-label="Saring mission" className="mb-4 flex flex-wrap gap-2">
      {MISSION_FILTERS.map((filter) => {
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

export function MissionTable({
  missions,
  now,
  canCreate = true,
  filter = "all",
}: {
  missions: Array<MissionListItem & { joinStatus?: JoinStatus }>
  now: Date
  /** Whether to offer "Mission baru" from the empty state. */
  canCreate?: boolean
  /** Which lens produced this list, so an empty result explains itself. */
  filter?: MissionFilter
}) {
  if (missions.length === 0) {
    // An empty lens is not an empty tenant. Offering "Mission baru" here would
    // answer a question nobody asked: there are missions, none are waiting.
    if (filter !== "all") {
      return (
        <EmptyState
          title={filter === "mine" ? "Tidak ada yang menunggu jawaban Anda" : "Semua sudah menjawab"}
          description={
            filter === "mine"
              ? "Penugasan baru muncul di sini begitu Anda ditambahkan ke sebuah mission."
              : "Setiap sales pada mission yang masih berjalan sudah memberi jawaban."
          }
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/workspace/missions">Lihat semua mission</Link>
            </Button>
          }
        />
      )
    }

    return (
      <EmptyState
        title="Belum ada mission"
        // A rep who cannot schedule is told who can, rather than being handed a
        // button that would only bounce them back here.
        description={
          canCreate
            ? "Mission yang dibuat akan muncul di sini beserta jadwal dan sales yang ditugaskan."
            : "Mission yang dijadwalkan untuk unit bisnis ini akan muncul di sini. Penjadwalan dilakukan oleh tim appointment atau admin."
        }
        action={canCreate ? <NewMissionAction /> : undefined}
      />
    )
  }

  return (
    <>
      {/*
        Mobile gets cards, not a squeezed table. The eight columns need about
        781px with their headers set to nowrap, and a 375px phone offers 343px.
      */}
      <ul className="space-y-3 md:hidden">
        {missions.map((mission) => (
          <li key={mission.id}>
            <Link
              href={`/workspace/missions/${mission.id}`}
              className="block rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-foreground">{mission.clientCompanyName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{mission.missionType}</span>
                </span>
                <StatusBadge status={mission.status} />
              </div>

              <p className="mt-3 text-sm text-foreground">{formatMissionSchedule(mission.scheduledStart, now)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {[mission.location, mission.primarySalesName ?? "Belum ditugaskan"].filter(Boolean).join(" · ")}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {mission.joinStatus && <JoinStatusChip status={mission.joinStatus} />}
                <AnswerCell mission={mission} />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/*
        The scroll lives on an inner element so the rounded border stays put.
        This container used to clip instead: at 781px min-content the eight
        columns overrun a 768px tablet by 82px, and the overrun lands on the
        "Buka" arrow — the row itself is not a link, so that arrow is the only
        way into a mission from this table. Clipping it hid the affordance
        entirely, and tabbing to it scroll-jumped the container sideways.
      */}
      <div className="hidden rounded-xl border bg-card md:block">
      <div className="data-table-scroll overflow-x-auto rounded-xl">
      <Table className="min-w-[790px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Mission</TableHead>
            <TableHead>Jadwal</TableHead>
            <TableHead>Lokasi</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sales utama</TableHead>
            <TableHead>Jawaban</TableHead>
            <TableHead>Tim</TableHead>
            <TableHead className="w-10"><span className="sr-only">Buka</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {missions.map((mission) => (
            <TableRow key={mission.id}>
              <TableCell>
                <span className="block font-semibold text-foreground">{mission.clientCompanyName}</span>
                <span className="block text-xs text-muted-foreground">{mission.missionType}</span>
              </TableCell>
              <TableCell className="text-sm">{formatMissionSchedule(mission.scheduledStart, now)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{mission.location ?? "Belum diisi"}</TableCell>
              <TableCell><StatusBadge status={mission.status} /></TableCell>
              <TableCell className="text-sm">{mission.primarySalesName ?? <span className="text-muted-foreground">Belum ditugaskan</span>}</TableCell>
              <TableCell><AnswerCell mission={mission} /></TableCell>
              <TableCell>{mission.joinStatus ? <JoinStatusChip status={mission.joinStatus} /> : null}</TableCell>
              <TableCell>
                <Link
                  href={`/workspace/missions/${mission.id}`}
                  aria-label={`Buka ${mission.clientCompanyName}`}
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
      </div>
    </>
  )
}
