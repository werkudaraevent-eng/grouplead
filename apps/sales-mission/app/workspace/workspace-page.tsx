import Link from "next/link"
import { ArrowLeft, ArrowUpRight, ClipboardList, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatMissionSchedule, type MissionListItem } from "@/lib/missions/mission-schema"
import { JOIN_STATUS_LABELS, type JoinStatus } from "@/lib/missions/mission-join"
import {
  MISSION_FILTER_LABELS,
  availableMissionFilters,
  isAwaitingTeam,
  needsMyAnswer,
  type MissionFilter,
} from "@/lib/missions/mission-filter"
import type { ConfirmationPolicy } from "@/lib/missions/assignment-workflow"
import { statusLabel } from "@/lib/missions/status-labels"
import { AcceptAssignmentButton, AssignmentOverflowMenu } from "@/app/workspace/missions/assignment-actions-menu"
import { JoinButton } from "@/app/workspace/missions/join-controls"

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
  if (status === "JOINABLE") return null
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

/**
 * A second line under the status about the team's answers, shown only while
 * confirmation is on and someone still owes one. With confirmation off nobody
 * is ever asked, so nothing is ever waiting and the line would be noise.
 *
 * Split on `isAwaitingTeam` rather than on the raw count, because the same
 * number means two different things: a chase list on a mission that can still
 * be answered, and history on one that is finished, where nagging about a
 * visit that already happened helps nobody.
 */
function TeamAnswersLine({ mission, policy }: { mission: MissionListItem; policy: ConfirmationPolicy }) {
  if (!policy.requireAssignmentConfirmation) return null
  if (needsMyAnswer(mission, policy)) {
    return <span className="block text-xs font-medium text-[var(--warning-foreground)]">Menunggu jawabanmu</span>
  }
  if (isAwaitingTeam(mission, policy)) {
    return <span className="block text-xs text-muted-foreground">{mission.pendingResponses} belum jawab</span>
  }
  return null
}

/**
 * The one column that does things. Material's rule for a row that needs a
 * decision: the primary action is a filled button in the row, the rest sit
 * behind an overflow menu, and a row that needs nothing gets only its link.
 */
function ActionCell({
  mission,
  policy,
  maxSupporting,
}: {
  mission: MissionListItem & { joinStatus?: JoinStatus }
  policy: ConfirmationPolicy
  maxSupporting: number
}) {
  const open = (
    <Link
      href={`/workspace/missions/${mission.id}`}
      aria-label={`Buka ${mission.clientCompanyName}`}
      className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-8 md:w-8"
    >
      <ArrowUpRight className="h-4 w-4" />
    </Link>
  )

  if (needsMyAnswer(mission, policy)) {
    return (
      <span className="flex items-center justify-end gap-1.5">
        <AcceptAssignmentButton missionId={mission.id} />
        <AssignmentOverflowMenu missionId={mission.id} />
        {open}
      </span>
    )
  }

  if (mission.joinStatus === "JOINABLE") {
    return (
      <span className="flex items-center justify-end gap-1.5">
        <JoinButton missionId={mission.id} status="JOINABLE" maxSupporting={maxSupporting} />
        {open}
      </span>
    )
  }

  return <span className="flex justify-end">{open}</span>
}

/**
 * Lenses over the same list, as links rather than a client-side control: the
 * chosen lens belongs in the URL so it survives a reload and can be shared with
 * the admin who is chasing the same answers.
 */
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

export function MissionTable({
  missions,
  now,
  canCreate = true,
  filter = "all",
  policy = { requireAssignmentConfirmation: false },
  maxSupporting = 2,
}: {
  missions: Array<MissionListItem & { joinStatus?: JoinStatus }>
  now: Date
  /** Whether to offer "Mission baru" from the empty state. */
  canCreate?: boolean
  /** Which lens produced this list, so an empty result explains itself. */
  filter?: MissionFilter
  /** Whether reps are asked to confirm assignments; decides what the Aksi column offers. */
  policy?: ConfirmationPolicy
  maxSupporting?: number
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
        {missions.map((mission) => {
          const asksMe = needsMyAnswer(mission, policy)
          return (
            <li
              key={mission.id}
              className={cn(
                "rounded-xl border bg-card",
                // A row that asks the reader for something is marked by its
                // edge, the way Material tones a list item that needs
                // attention, rather than by a pill that shouts.
                asksMe && "border-l-4 border-l-[var(--warning-foreground)]"
              )}
            >
              {/* The card body is the link; the buttons sit outside it so a
                  tap on Terima never also opens the page. */}
              <Link
                href={`/workspace/missions/${mission.id}`}
                className="block p-4 transition-colors hover:bg-muted/50"
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
                <span className="mt-2 block">
                  {mission.joinStatus && <JoinStatusLine status={mission.joinStatus} />}
                  <TeamAnswersLine mission={mission} policy={policy} />
                </span>
              </Link>

              {(asksMe || mission.joinStatus === "JOINABLE") && (
                <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                  {asksMe ? (
                    <>
                      <AssignmentOverflowMenu missionId={mission.id} />
                      <AcceptAssignmentButton missionId={mission.id} size="default" className="h-11" />
                    </>
                  ) : (
                    <JoinButton missionId={mission.id} status="JOINABLE" maxSupporting={maxSupporting} size="default" />
                  )}
                </div>
              )}
            </li>
          )
        })}
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
      {/*
        Six columns, down from eight. "Jawaban" and "Tim" were two more ways
        of saying what Status and Aksi already say: the answer state is a line
        under the status, and anything that can be done about it is a button.
      */}
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Mission</TableHead>
            <TableHead>Jadwal</TableHead>
            <TableHead>Lokasi</TableHead>
            <TableHead>Sales utama</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {missions.map((mission) => {
            const asksMe = needsMyAnswer(mission, policy)
            return (
              <TableRow
                key={mission.id}
                className={cn(asksMe && "shadow-[inset_4px_0_0_0_var(--warning-foreground)]")}
              >
                <TableCell>
                  <span className="block font-semibold text-foreground">{mission.clientCompanyName}</span>
                  <span className="block text-xs text-muted-foreground">{mission.missionType}</span>
                </TableCell>
                <TableCell className="text-sm">{formatMissionSchedule(mission.scheduledStart, now)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{mission.location ?? "Belum diisi"}</TableCell>
                <TableCell className="text-sm">
                  {mission.primarySalesName ?? <span className="text-muted-foreground">Belum ditugaskan</span>}
                  {mission.supportingCount > 0 && (
                    <span className="block text-xs text-muted-foreground">+{mission.supportingCount} pendukung</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={mission.status} />
                  {mission.joinStatus && <JoinStatusLine status={mission.joinStatus} />}
                  <TeamAnswersLine mission={mission} policy={policy} />
                </TableCell>
                <TableCell className="w-px whitespace-nowrap">
                  <ActionCell mission={mission} policy={policy} maxSupporting={maxSupporting} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      </div>
      </div>
    </>
  )
}
