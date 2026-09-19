"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { ViewLink } from "@/components/remember-view"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ClipboardList, Loader2, Trash2, X } from "@/components/icons"
import { deleteMissions, matchingMissionIds } from "@/app/actions/mission-actions"
import { useSearchParams } from "next/navigation"
import { MissionPagination, SortHeader } from "./mission-pagination"
import type { MissionSort } from "@/lib/missions/mission-paging"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatMissionSchedule, type MissionListItem } from "@/lib/missions/mission-schema"
import type { JoinStatus } from "@/lib/missions/mission-join"
import { isAwaitingTeam, needsMyAnswer, type MissionFilter } from "@/lib/missions/mission-filter"
import type { ConfirmationPolicy } from "@/lib/missions/assignment-workflow"
import { EmptyState, JoinStatusLine, NewMissionAction, StatusBadge } from "@/app/workspace/workspace-page"
import { VISIT_STATE_LABELS, reportOwed, visitState } from "@/lib/missions/visit-state"
import { statusLabel } from "@/lib/missions/status-labels"
import { AcceptAssignmentButton, AssignmentOverflowMenu } from "./assignment-actions-menu"
import { JoinButton } from "./join-controls"
import { useSelectionMode } from "@/components/selection-mode"
import { SelectableCardBody } from "@/components/selectable-card-body"
import { TeamFacepile, type FacepilePerson } from "@/components/team-facepile"
import { useRowLink } from "@/components/row-link"
import { paths } from "@/lib/paths"

type Row = MissionListItem & { joinStatus?: JoinStatus; canReport?: boolean }

/**
 * A second line under the status about the team's answers, shown only while
 * confirmation is on and someone still owes one. With confirmation off nobody
 * is ever asked, so nothing is ever waiting and the line would be noise.
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
 * Status, read from the report's side once the visit has passed.
 *
 * Before the slot, the lifecycle is the news ("Diterima"). After it, the
 * question changes to "was it written down", so the label changes with it:
 * "Belum ada laporan" in the warning tone, "Laporan draf", or "Selesai" with
 * the outcome underneath. The lifecycle drops to the secondary line, the
 * way Asana and Salesforce show "overdue" over a task's own state.
 */
function VisitStatus({ mission, now }: { mission: Row; now: Date }) {
  const state = visitState(mission, now)
  if (state === "needs_report" || state === "draft") {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-foreground">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[var(--warning-foreground)]" />
        {VISIT_STATE_LABELS[state]}
      </span>
    )
  }
  if (state === "reported") {
    return (
      <>
        <StatusBadge status="COMPLETED" />
        {mission.visitOutcome && (
          <span className="block text-xs text-muted-foreground">
            {mission.visitOutcomeLabel ?? mission.visitOutcome}
          </span>
        )}
      </>
    )
  }
  return <StatusBadge status={mission.status} />
}

/** The lifecycle, once it has become secondary to the report. */
function LifecycleLine({ mission, now }: { mission: Row; now: Date }) {
  const state = visitState(mission, now)
  if (state !== "needs_report" && state !== "draft") return null
  return <span className="block text-xs text-muted-foreground">{statusLabel(mission.status)} · jadwal sudah lewat</span>
}

/**
 * The one column that does things. Material's rule for a row that needs a
 * decision: the primary action is a filled button in the row, the rest sit
 * behind an overflow menu, and a row that needs nothing gets only its link.
 */
/** The lead first, then the rest of the team, photos where the unit has them. */
function teamOf(mission: Row, people: Map<string, FacepilePerson>): FacepilePerson[] {
  return [
    ...(mission.primarySalesName ? [people.get(mission.primarySalesId ?? "") ?? { name: mission.primarySalesName }] : []),
    ...mission.assigneeIds
      .filter((id) => id !== mission.primarySalesId)
      .map((id, index) => people.get(id) ?? { name: mission.supportingSalesNames[index] ?? "Sales pendukung" }),
  ]
}

function ActionCell({
  mission,
  policy,
  maxSupporting,
  now,
}: {
  mission: Row
  policy: ConfirmationPolicy
  maxSupporting: number
  now: Date
}) {
  // A visit that owes a report gets the report button, for whoever may write
  // it (decided per row by the server from the matrix). Same rule as Terima:
  // a row that needs something offers the thing, right there.
  const state = visitState(mission, now)
  if (reportOwed(state) && mission.canReport === true) {
    return (
      <span className="flex items-center justify-end gap-1.5">
        <Button asChild size="sm">
          <Link href={paths.activityReport(mission.id)}>
            <ClipboardList className="h-4 w-4" /> {state === "draft" ? "Lanjutkan laporan" : "Isi laporan"}
          </Link>
        </Button>
      </span>
    )
  }

  if (needsMyAnswer(mission, policy)) {
    return (
      <span className="flex items-center justify-end gap-1.5">
        <AcceptAssignmentButton missionId={mission.id} />
        <AssignmentOverflowMenu missionId={mission.id} />
      </span>
    )
  }

  if (mission.joinStatus === "JOINABLE") {
    return (
      <span className="flex items-center justify-end gap-1.5">
        <JoinButton missionId={mission.id} status="JOINABLE" maxSupporting={maxSupporting} clientName={mission.clientCompanyName} />
      </span>
    )
  }

  // A reported visit: the report is the thing to read, one step from here.
  // Outlined, because reading is secondary to the row's own link.
  if (state === "reported") {
    return (
      <span className="flex items-center justify-end gap-1.5">
        <Button asChild size="sm" variant="outline">
          <Link href={paths.activity(mission.id, { fokus: "laporan" })}>
            <ClipboardList className="h-4 w-4" /> Lihat laporan
          </Link>
        </Button>
      </span>
    )
  }

  // Nothing to do on this row: the row itself opens the record.
  return null
}

/**
 * Select rows, act on the selection.
 *
 * The shape every mail client and issue tracker settled on: a checkbox per
 * row and one in the header, and the moment anything is ticked a bar appears
 * with the count and the actions that apply to a set. The bar sits above the
 * list rather than beside the toolbar, so there is never a question of which
 * buttons act on the selection and which on the whole list.
 */
function SelectionBar({
  count,
  onClear,
  onDelete,
  allMatching,
}: {
  count: number
  onClear: () => void
  onDelete: () => void
  /** Offered once every row on the page is ticked and more match beyond it. */
  allMatching?: { total: number; pending: boolean; onSelect: () => void; selected: boolean }
}) {
  return (
    <div
      role="region"
      aria-label="Tindakan untuk baris terpilih"
      className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5"
    >
      <span className="text-sm text-foreground">
        {count > 0 ? (
          <span className="font-semibold">{count} aktivitas dipilih</span>
        ) : (
          <span className="text-muted-foreground">Ketuk aktivitas untuk memilih</span>
        )}
        {allMatching && !allMatching.selected && (
          <>
            {" · "}
            <button type="button" onClick={allMatching.onSelect} disabled={allMatching.pending} className="font-semibold text-primary hover:underline">
              {allMatching.pending ? "Memuat…" : `Pilih semua ${allMatching.total} yang cocok`}
            </button>
          </>
        )}
        {allMatching?.selected && <span className="text-muted-foreground"> · semua yang cocok dengan filter</span>}
      </span>
      <span className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onDelete}
          disabled={count === 0}
          className="text-[var(--danger-foreground)] hover:text-[var(--danger-foreground)]"
        >
          <Trash2 className="h-4 w-4" /> Ke sampah
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} aria-label="Batalkan pilihan">
          <X className="h-4 w-4" /> Batal
        </Button>
      </span>
    </div>
  )
}

/**
 * One activity as a card, for the phone.
 *
 * The body is the link into the activity (`SelectableCardBody`: a long
 * press enters selection mode, a tap then ticks); the buttons sit outside
 * it so a tap on Terima never also opens the page. When and where share
 * one line, as a calendar shows an event, and who sits under it: three
 * lines and the status, so three cards fit a screen rather than one and a
 * half.
 */
function MobileMissionCard({
  mission,
  now,
  policy,
  maxSupporting,
  canDelete,
  selecting,
  ticked,
  onTick,
  onLongPress,
  people,
}: {
  mission: Row
  now: Date
  policy: ConfirmationPolicy
  maxSupporting: number
  canDelete: boolean
  selecting: boolean
  ticked: boolean
  onTick: (next: boolean) => void
  onLongPress: () => void
  /** The unit's sales, for their photos; a name with no match shows initials. */
  people: Map<string, FacepilePerson>
}) {
  const asksMe = needsMyAnswer(mission, policy)
  const team = teamOf(mission, people)
  const owesMe = reportOwed(visitState(mission, now)) && mission.canReport === true

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate font-semibold text-foreground">{mission.clientCompanyName}</span>
          <span className="block truncate text-xs text-muted-foreground">{mission.missionType}</span>
        </span>
        <span className="text-right"><VisitStatus mission={mission} now={now} /></span>
      </div>
      <p className="mt-2 truncate text-sm text-foreground">
        {[formatMissionSchedule(mission.scheduledStart, now), mission.location].filter(Boolean).join(" · ")}
      </p>
      <span className="mt-1.5 block">
        {mission.joinStatus && <JoinStatusLine status={mission.joinStatus} />}
        <TeamAnswersLine mission={mission} policy={policy} />
      </span>
    </>
  )

  return (
    <li
      className={cn(
        "rounded-xl border bg-card",
        // A row that asks the reader for something is marked by its
        // edge, the way Material tones a list item that needs
        // attention, rather than by a pill that shouts.
        (asksMe || owesMe) && "border-l-4 border-l-[var(--warning-foreground)]",
        ticked && "border-primary bg-primary/5"
      )}
    >
      <div className="flex">
        {selecting && (
          <span className="grid w-11 shrink-0 place-items-start pl-3 pt-4">
            <Checkbox
              checked={ticked}
              onCheckedChange={(value) => onTick(value === true)}
              aria-label={`Pilih ${mission.clientCompanyName}`}
            />
          </span>
        )}
        <SelectableCardBody href={paths.activity(mission.id)} selecting={selecting} ticked={ticked} onTick={onTick} onLongPress={onLongPress} enabled={canDelete}>
          {body}
        </SelectableCardBody>
      </div>

      {/* Who is going, then what the reader can do about it: the team at
          bottom-start, the one action at bottom-end (M3 card). Every card
          has the footer, so "who" is always in the same place. */}
      <div className="flex min-h-11 items-center justify-between gap-3 border-t px-3 py-2">
        <TeamFacepile people={team} />
        <span className="flex shrink-0 items-center gap-2">
          {owesMe ? (
            <Button asChild size="default" className="h-11">
              <Link href={paths.activityReport(mission.id)}>
                <ClipboardList className="h-4 w-4" /> {mission.reportStatus === "NONE" ? "Isi laporan" : "Lanjutkan laporan"}
              </Link>
            </Button>
          ) : asksMe ? (
            <>
              <AssignmentOverflowMenu missionId={mission.id} />
              <AcceptAssignmentButton missionId={mission.id} size="default" className="h-11" />
            </>
          ) : mission.joinStatus === "JOINABLE" ? (
            <JoinButton missionId={mission.id} status="JOINABLE" maxSupporting={maxSupporting} clientName={mission.clientCompanyName} size="default" className="h-11" />
          ) : visitState(mission, now) === "reported" ? (
            <Button asChild variant="outline" size="default" className="h-11">
              <Link href={paths.activity(mission.id, { fokus: "laporan" })}>
                <ClipboardList className="h-4 w-4" /> Lihat laporan
              </Link>
            </Button>
          ) : null}
        </span>
      </div>
    </li>
  )
}

export function MissionTable({
  missions,
  now,
  canCreate = true,
  canDelete = false,
  filter = "all",
  filtered = false,
  policy = { requireAssignmentConfirmation: false },
  maxSupporting = 2,
  pagination,
  people = [],
}: {
  /** Present when the list is a page of a larger set. */
  pagination?: { page: number; size: number; total: number; sort: MissionSort }
  /** The unit's sales, for the cards' avatars. */
  people?: Array<{ id: string; name: string; avatarUrl: string | null }>
  missions: Row[]
  now: Date
  /** Whether to offer "Mission baru" from the empty state. */
  canCreate?: boolean
  /** Whether rows can be ticked and removed. */
  canDelete?: boolean
  /** Which lens produced this list, so an empty result explains itself. */
  filter?: MissionFilter
  /** Whether the filter panel is narrowing the list, for the same reason. */
  filtered?: boolean
  /** Whether reps are asked to confirm assignments; decides what the Aksi column offers. */
  policy?: ConfirmationPolicy
  maxSupporting?: number
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // The phone's cards show their checkboxes only in this mode; the desk's
  // table always does.
  const { selecting, setSelecting } = useSelectionMode()
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()
  const [loadingAll, startLoadingAll] = useTransition()
  // Ids beyond the page, once "pilih semua yang cocok" was used.
  const [beyondPage, setBeyondPage] = useState<Set<string>>(new Set())
  const router = useRouter()
  const rowLink = useRowLink()
  const searchParams = useSearchParams()

  const visibleIds = useMemo(() => new Set(missions.map((mission) => mission.id)), [missions])
  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, { name: person.name, avatarUrl: person.avatarUrl }])), [people])
  // What is on screen, plus what "select all matching" added.
  const chosen = [...new Set([...[...selected].filter((id) => visibleIds.has(id)), ...beyondPage])]
  const pageChosen = chosen.filter((id) => visibleIds.has(id)).length
  const allChosen = missions.length > 0 && pageChosen === missions.length
  const moreMatch = pagination ? pagination.total > missions.length : false

  const selectAllMatching = () => {
    startLoadingAll(async () => {
      const result = await matchingMissionIds(Object.fromEntries(searchParams))
      if (result.success && result.data) {
        setSelected(new Set(missions.map((mission) => mission.id)))
        setBeyondPage(new Set(result.data.ids.filter((id) => !visibleIds.has(id))))
        if (result.data.capped) toast.message(`Dipilih ${result.data.ids.length} dari ${result.data.total}. Paling banyak 500 sekaligus.`)
      } else {
        toast.error(result.error ?? "Gagal memuat daftar")
      }
    })
  }
  const clearSelection = () => {
    setSelected(new Set())
    setBeyondPage(new Set())
    setSelecting(false)
  }

  const toggle = (id: string, next: boolean) =>
    setSelected((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(id)
      else copy.delete(id)
      return copy
    })
  const toggleAll = (next: boolean) => {
    setBeyondPage(new Set())
    setSelected(next ? new Set(missions.map((mission) => mission.id)) : new Set())
  }

  const remove = () => {
    start(async () => {
      const result = await deleteMissions(chosen)
      if (result.success) {
        const deleted = result.data?.deleted ?? chosen.length
        const skipped = result.data?.skipped ?? 0
        toast.success(`${deleted} aktivitas dipindahkan ke sampah${skipped ? `, ${skipped} dilewati karena di luar cakupan` : ""}`)
        clearSelection()
        setConfirming(false)
        router.refresh()
      } else {
        toast.error(result.error ?? "Aktivitas gagal dipindahkan ke sampah")
      }
    })
  }

  if (missions.length === 0) {
    // An empty lens or filter is not an empty tenant. Offering "Mission baru"
    // here would answer a question nobody asked.
    if (filter !== "all" || filtered) {
      return (
        <EmptyState
          title={
            filter === "mine"
              ? "Tidak ada yang menunggu jawaban Anda"
              : filter === "team"
                ? "Semua sudah menjawab"
                : "Tidak ada aktivitas yang cocok"
          }
          description={
            filter === "mine"
              ? "Penugasan baru muncul di sini begitu Anda ditambahkan ke sebuah aktivitas."
              : filter === "team"
                ? "Setiap sales pada aktivitas yang masih berjalan sudah memberi jawaban."
                : "Longgarkan filter atau hapus salah satu untuk melihat lebih banyak."
          }
          action={
            <Button asChild variant="outline" size="sm">
              <ViewLink list="activities" href={paths.activities()}>Lihat semua aktivitas</ViewLink>
            </Button>
          }
        />
      )
    }

    return (
      <EmptyState
        title={canCreate ? "Jadwalkan kunjungan pertama" : "Belum ada aktivitas"}
        // A rep who cannot schedule is told who can, rather than being handed a
        // button that would only bounce them back here.
        description={
          canCreate
            ? "Satu aktivitas adalah satu kunjungan ke satu klien: siapa yang pergi, kapan, ke mana, dan untuk apa."
            : "Aktivitas yang dijadwalkan untuk unit bisnis ini akan muncul di sini. Penjadwalan dilakukan oleh tim appointment atau admin."
        }
        steps={
          canCreate
            ? [
                "Ketuk Aktivitas baru, pilih klien dan jadwalnya",
                "Tugaskan sales utama; pendukung boleh Join sendiri",
                "Setelah kunjungan, sales utama mengisi laporannya",
              ]
            : undefined
        }
        action={canCreate ? <NewMissionAction /> : undefined}
        learnHref={paths.guideSection("aktivitas")}
      />
    )
  }

  return (
    <>
      {canDelete && (chosen.length > 0 || selecting) && (
        <SelectionBar
          count={chosen.length}
          onClear={clearSelection}
          onDelete={() => setConfirming(true)}
          allMatching={
            allChosen && moreMatch && pagination
              ? { total: pagination.total, pending: loadingAll, onSelect: selectAllMatching, selected: beyondPage.size > 0 }
              : undefined
          }
        />
      )}

      {/* Mobile gets cards, not a squeezed table. */}
      <ul className="space-y-3 md:hidden">
        {missions.map((mission) => (
          <MobileMissionCard
            key={mission.id}
            mission={mission}
            now={now}
            policy={policy}
            maxSupporting={maxSupporting}
            canDelete={canDelete}
            selecting={canDelete && selecting}
            ticked={selected.has(mission.id)}
            people={peopleById}
            onTick={(next) => toggle(mission.id, next)}
            onLongPress={() => {
              setSelecting(true)
              toggle(mission.id, true)
            }}
          />
        ))}
      </ul>

      {/*
        The scroll lives on an inner element so the rounded border stays put.
        The row itself is not a link, so the "Buka" arrow is the only way into
        a mission from this table; clipping it would hide the affordance.
      */}
      <div className="hidden rounded-xl border bg-card md:block">
      <div className="data-table-scroll overflow-x-auto rounded-xl">
      {/* Same rule as the prospect table: fixed layout, the mission column
          takes what is left, the rest are sized to what they actually hold
          (a date, a facepile, a status with a second line, one button), and
          the location and sales columns leave at narrower widths before
          anything scrolls. Generous widths here are not free: on a 1280px
          laptop the mission column is what pays for them. */}
      <Table className="min-w-[960px] table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {canDelete && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allChosen ? true : chosen.length > 0 ? "indeterminate" : false}
                  onCheckedChange={(value) => toggleAll(value === true)}
                  aria-label="Pilih semua aktivitas di halaman ini"
                />
              </TableHead>
            )}
            <TableHead>{pagination ? <SortHeader column="client" label="Aktivitas" sort={pagination.sort} /> : "Aktivitas"}</TableHead>
            <TableHead className="w-[130px]">{pagination ? <SortHeader column="schedule" label="Jadwal" sort={pagination.sort} /> : "Jadwal"}</TableHead>
            <TableHead className="hidden w-[150px] 2xl:table-cell">{pagination ? <SortHeader column="location" label="Lokasi" sort={pagination.sort} /> : "Lokasi"}</TableHead>
            <TableHead className="hidden w-[210px] xl:table-cell">{pagination ? <SortHeader column="sales" label="Sales utama" sort={pagination.sort} /> : "Sales utama"}</TableHead>
            <TableHead className="w-[200px]">{pagination ? <SortHeader column="status" label="Status" sort={pagination.sort} /> : "Status"}</TableHead>
            <TableHead className="w-[170px] text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {missions.map((mission) => {
            const asksMe = needsMyAnswer(mission, policy)
            const owesMe = reportOwed(visitState(mission, now)) && mission.canReport === true
            const ticked = selected.has(mission.id)
            return (
              <TableRow
                key={mission.id}
                data-state={ticked ? "selected" : undefined}
                onClick={rowLink(paths.activity(mission.id))}
                className={cn("cursor-pointer", (asksMe || owesMe) && "shadow-[inset_4px_0_0_0_var(--warning-foreground)]", ticked && "bg-primary/5")}
              >
                {canDelete && (
                  <TableCell>
                    <Checkbox
                      checked={ticked}
                      onCheckedChange={(value) => toggle(mission.id, value === true)}
                      aria-label={`Pilih ${mission.clientCompanyName}`}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <Link href={paths.activity(mission.id)} className="block truncate font-semibold text-foreground hover:underline" title={mission.clientCompanyName}>{mission.clientCompanyName}</Link>
                  <span className="block truncate text-xs text-muted-foreground">{mission.missionType}</span>
                </TableCell>
                <TableCell className="text-sm">{formatMissionSchedule(mission.scheduledStart, now)}</TableCell>
                <TableCell className="hidden truncate text-sm text-muted-foreground 2xl:table-cell" title={mission.location ?? undefined}>{mission.location ?? "Belum diisi"}</TableCell>
                <TableCell className="hidden xl:table-cell">
                  {/* The same faces as the phone's card: the lead first, then the team. */}
                  <TeamFacepile people={teamOf(mission, peopleById)} />
                </TableCell>
                <TableCell>
                  <VisitStatus mission={mission} now={now} />
                  <LifecycleLine mission={mission} now={now} />
                  {mission.joinStatus && <JoinStatusLine status={mission.joinStatus} />}
                  <TeamAnswersLine mission={mission} policy={policy} />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <ActionCell mission={mission} policy={policy} maxSupporting={maxSupporting} now={now} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      </div>
      {pagination && <MissionPagination page={pagination.page} size={pagination.size} total={pagination.total} />}
      </div>
      {pagination && (
        <div className="mt-3 overflow-hidden rounded-xl border bg-card md:hidden">
          <MissionPagination page={pagination.page} size={pagination.size} total={pagination.total} />
        </div>
      )}

      <Dialog open={confirming} onOpenChange={(next) => { if (!pending) setConfirming(next) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pindahkan {chosen.length} aktivitas ke sampah?</DialogTitle>
            <DialogDescription>
              Aktivitas hilang dari daftar, kalender, dan papan, tetapi laporan, penugasan, dan catatannya tetap tersimpan.
              Admin bisa memulihkannya dari Pengaturan → Sampah selama 30 hari; setelah itu terhapus permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>Kembali</Button>
            <Button
              onClick={remove}
              disabled={pending}
              className="bg-[var(--danger-foreground)] text-white hover:bg-[var(--danger-foreground)]/90"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Pindahkan ke sampah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
