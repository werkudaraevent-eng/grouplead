"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowUpRight, Loader2, Trash2, X } from "lucide-react"
import { deleteMissions } from "@/app/actions/mission-actions"
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
import { AcceptAssignmentButton, AssignmentOverflowMenu } from "./assignment-actions-menu"
import { JoinButton } from "./join-controls"

type Row = MissionListItem & { joinStatus?: JoinStatus }

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
 * The one column that does things. Material's rule for a row that needs a
 * decision: the primary action is a filled button in the row, the rest sit
 * behind an overflow menu, and a row that needs nothing gets only its link.
 */
function ActionCell({ mission, policy, maxSupporting }: { mission: Row; policy: ConfirmationPolicy; maxSupporting: number }) {
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
 * Select rows, act on the selection.
 *
 * The shape every mail client and issue tracker settled on: a checkbox per
 * row and one in the header, and the moment anything is ticked a bar appears
 * with the count and the actions that apply to a set. The bar sits above the
 * list rather than beside the toolbar, so there is never a question of which
 * buttons act on the selection and which on the whole list.
 */
function SelectionBar({ count, onClear, onDelete }: { count: number; onClear: () => void; onDelete: () => void }) {
  return (
    <div
      role="region"
      aria-label="Tindakan untuk baris terpilih"
      className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5"
    >
      <span className="text-sm font-semibold text-foreground">{count} mission dipilih</span>
      <span className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onDelete}
          className="text-[var(--danger-foreground)] hover:text-[var(--danger-foreground)]"
        >
          <Trash2 className="h-4 w-4" /> Hapus
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} aria-label="Batalkan pilihan">
          <X className="h-4 w-4" /> Batal
        </Button>
      </span>
    </div>
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
}: {
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
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()

  // Selection only ever refers to rows on screen; a filter change drops the rest.
  const visibleIds = useMemo(() => new Set(missions.map((mission) => mission.id)), [missions])
  const chosen = [...selected].filter((id) => visibleIds.has(id))
  const allChosen = missions.length > 0 && chosen.length === missions.length

  const toggle = (id: string, next: boolean) =>
    setSelected((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(id)
      else copy.delete(id)
      return copy
    })
  const toggleAll = (next: boolean) => setSelected(next ? new Set(missions.map((mission) => mission.id)) : new Set())

  const remove = () => {
    start(async () => {
      const result = await deleteMissions(chosen)
      if (result.success) {
        toast.success(`${chosen.length} mission dihapus`)
        setSelected(new Set())
        setConfirming(false)
        router.refresh()
      } else {
        toast.error(result.error ?? "Mission gagal dihapus")
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
                : "Tidak ada mission yang cocok"
          }
          description={
            filter === "mine"
              ? "Penugasan baru muncul di sini begitu Anda ditambahkan ke sebuah mission."
              : filter === "team"
                ? "Setiap sales pada mission yang masih berjalan sudah memberi jawaban."
                : "Longgarkan filter atau hapus salah satu untuk melihat lebih banyak."
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
      {canDelete && chosen.length > 0 && (
        <SelectionBar count={chosen.length} onClear={() => setSelected(new Set())} onDelete={() => setConfirming(true)} />
      )}

      {/* Mobile gets cards, not a squeezed table. */}
      <ul className="space-y-3 md:hidden">
        {missions.map((mission) => {
          const asksMe = needsMyAnswer(mission, policy)
          const ticked = selected.has(mission.id)
          return (
            <li
              key={mission.id}
              className={cn(
                "rounded-xl border bg-card",
                // A row that asks the reader for something is marked by its
                // edge, the way Material tones a list item that needs
                // attention, rather than by a pill that shouts.
                asksMe && "border-l-4 border-l-[var(--warning-foreground)]",
                ticked && "border-primary bg-primary/5"
              )}
            >
              <div className="flex">
                {canDelete && (
                  <span className="grid w-11 shrink-0 place-items-start pl-3 pt-4">
                    <Checkbox
                      checked={ticked}
                      onCheckedChange={(value) => toggle(mission.id, value === true)}
                      aria-label={`Pilih ${mission.clientCompanyName}`}
                    />
                  </span>
                )}
                {/* The card body is the link; the buttons sit outside it so a
                    tap on Terima never also opens the page. */}
                <Link
                  href={`/workspace/missions/${mission.id}`}
                  className={cn("block min-w-0 flex-1 p-4 transition-colors hover:bg-muted/50", canDelete && "pl-2")}
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
              </div>

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
        The row itself is not a link, so the "Buka" arrow is the only way into
        a mission from this table; clipping it would hide the affordance.
      */}
      <div className="hidden rounded-xl border bg-card md:block">
      <div className="data-table-scroll overflow-x-auto rounded-xl">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {canDelete && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allChosen ? true : chosen.length > 0 ? "indeterminate" : false}
                  onCheckedChange={(value) => toggleAll(value === true)}
                  aria-label="Pilih semua mission di halaman ini"
                />
              </TableHead>
            )}
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
            const ticked = selected.has(mission.id)
            return (
              <TableRow
                key={mission.id}
                data-state={ticked ? "selected" : undefined}
                className={cn(asksMe && "shadow-[inset_4px_0_0_0_var(--warning-foreground)]", ticked && "bg-primary/5")}
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

      <Dialog open={confirming} onOpenChange={(next) => { if (!pending) setConfirming(next) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus {chosen.length} mission?</DialogTitle>
            <DialogDescription>
              Laporan kunjungan, penugasan, catatan, dan usulan jadwal di dalamnya ikut terhapus. Riwayat aktivitas
              tetap mencatat siapa yang menghapus dan apa isinya. Tidak bisa dibatalkan.
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
              Hapus {chosen.length} mission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
