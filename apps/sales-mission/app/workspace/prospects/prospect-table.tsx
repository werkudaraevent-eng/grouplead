"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowUpRight, CalendarCheck, Loader2, MoreVertical, Phone, Plus, Trash2, UserPlus, X } from "@/components/icons"
import { deleteProspects, assignProspects, matchingProspectIds } from "@/app/actions/prospect-actions"
import { MissionPagination } from "@/app/workspace/missions/mission-pagination"
import { SortHeader } from "@/components/sort-header"
import { nextProspectSort, prospectSortParts, type ProspectSort, type ProspectSortColumn } from "@/lib/prospects/prospect-paging"
import { COLOR_DOT, displayStatus, type ProspectStatus } from "@/lib/prospects/prospect-status"
import { describeDueDate, type ProspectListItem } from "@/lib/prospects/prospect-schema"
import { canEditProspect } from "@/lib/prospects/prospect-access"
import { formatPhone } from "@/lib/format/phone"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { EmptyState } from "@/app/workspace/workspace-page"
import { PersonAvatar } from "@/components/person-avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { AssignDialog, ChangeStatusDialog, LogAttemptDialog, type DialogTarget } from "./prospect-dialogs"
import type { Person } from "@/app/workspace/missions/new/people-picker"

/**
 * The prospect list: the mission table's shape (selection bar, cards on a
 * phone, a table from md up, one filled action per row plus an overflow
 * menu), with the status as a dot and label that follows the mission once
 * the prospect has one.
 */

export function ProspectStatusLabel({ prospect }: { prospect: Pick<ProspectListItem, "statusLabel" | "statusColor" | "statusKind" | "displayState"> }) {
  const shown = displayStatus({ label: prospect.statusLabel, color: prospect.statusColor, kind: prospect.statusKind }, prospect.displayState)
  return (
    <span className="inline-flex items-center gap-2 text-sm text-foreground">
      <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", COLOR_DOT[shown.color])} />
      {shown.label}
    </span>
  )
}

/** The second line under the status: what the contact history says. */
function ContactLine({ prospect, today }: { prospect: ProspectListItem; today: string }) {
  if (prospect.missionId) return null
  if (prospect.nextContactAt && (prospect.statusKind === "open" || prospect.statusKind === "in_progress")) {
    const due = describeDueDate(prospect.nextContactAt, today)
    return <span className={cn("block text-xs", due.due ? "font-medium text-[var(--warning-foreground)]" : "text-muted-foreground")}>Hubungi lagi {due.text}</span>
  }
  if (prospect.attemptCount > 0 && prospect.lastContactedAt) {
    const when = new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short" }).format(new Date(prospect.lastContactedAt))
    return <span className="block text-xs text-muted-foreground">{prospect.attemptCount}× dihubungi · terakhir {when}</span>
  }
  if (prospect.statusKind === "lost" && prospect.lostReason) {
    return <span className="block text-xs text-muted-foreground">{prospect.lostReason}</span>
  }
  return <span className="block text-xs text-muted-foreground">Belum pernah dihubungi</span>
}

function SelectionBar({
  count,
  onClear,
  onDelete,
  onStatus,
  onAssign,
  canDelete,
  canAssign,
  allMatching,
}: {
  count: number
  onClear: () => void
  onDelete: () => void
  onStatus: () => void
  onAssign: () => void
  canDelete: boolean
  canAssign: boolean
  allMatching?: { total: number; pending: boolean; onSelect: () => void; selected: boolean }
}) {
  return (
    <div role="region" aria-label="Tindakan untuk baris terpilih" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
      <span className="text-sm text-foreground">
        <span className="font-semibold">{count} prospek dipilih</span>
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
      <span className="flex flex-wrap items-center gap-2">
        {canAssign && (
          <Button size="sm" variant="outline" onClick={onAssign}>
            <UserPlus className="h-4 w-4" /> Tugaskan ke
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onStatus}>Ubah status</Button>
        {canDelete && (
          <Button size="sm" variant="outline" onClick={onDelete} className="text-[var(--danger-foreground)] hover:text-[var(--danger-foreground)]">
            <Trash2 className="h-4 w-4" /> Ke sampah
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClear} aria-label="Batalkan pilihan">
          <X className="h-4 w-4" /> Batal
        </Button>
      </span>
    </div>
  )
}

export function ProspectTable({
  prospects,
  statuses,
  people,
  today,
  viewer,
  canCreate,
  canUpdate,
  canDelete,
  canCreateMission,
  filtered,
  pagination,
}: {
  prospects: ProspectListItem[]
  statuses: ProspectStatus[]
  people: Person[]
  today: string
  viewer: { userId: string; isAdmin: boolean }
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  canCreateMission: boolean
  filtered: boolean
  pagination: { page: number; size: number; total: number; sort: ProspectSort }
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [beyondPage, setBeyondPage] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [statusTarget, setStatusTarget] = useState<DialogTarget | null>(null)
  const [attemptTarget, setAttemptTarget] = useState<{ target: DialogTarget; statusId: string } | null>(null)
  const [assignTarget, setAssignTarget] = useState<DialogTarget | null>(null)
  const [pending, start] = useTransition()
  const [loadingAll, startLoadingAll] = useTransition()

  const visibleIds = useMemo(() => new Set(prospects.map((item) => item.id)), [prospects])
  const chosen = [...new Set([...[...selected].filter((id) => visibleIds.has(id)), ...beyondPage])]
  const pageChosen = chosen.filter((id) => visibleIds.has(id)).length
  const allChosen = prospects.length > 0 && pageChosen === prospects.length
  const moreMatch = pagination.total > prospects.length
  const selectable = canUpdate || canDelete

  const clearSelection = () => { setSelected(new Set()); setBeyondPage(new Set()) }
  const toggle = (id: string, next: boolean) => setSelected((prev) => { const copy = new Set(prev); if (next) copy.add(id); else copy.delete(id); return copy })
  const toggleAll = (next: boolean) => { setBeyondPage(new Set()); setSelected(next ? new Set(prospects.map((item) => item.id)) : new Set()) }
  const selectAllMatching = () => {
    startLoadingAll(async () => {
      const result = await matchingProspectIds(Object.fromEntries(searchParams))
      if (result.success && result.data) {
        setSelected(new Set(prospects.map((item) => item.id)))
        setBeyondPage(new Set(result.data.ids.filter((id) => !visibleIds.has(id))))
        if (result.data.capped) toast.message(`Dipilih ${result.data.ids.length} dari ${result.data.total}. Paling banyak 500 sekaligus.`)
      } else toast.error(result.error ?? "Gagal memuat daftar")
    })
  }

  const remove = () => {
    start(async () => {
      const result = await deleteProspects(chosen)
      if (result.success) {
        toast.success(`${result.data?.deleted ?? chosen.length} prospek dipindahkan ke sampah`)
        clearSelection(); setConfirmDelete(false); router.refresh()
      } else toast.error(result.error ?? "Prospek gagal dipindahkan ke sampah")
    })
  }

  const claim = (prospect: ProspectListItem) => {
    start(async () => {
      const result = await assignProspects([prospect.id], viewer.userId)
      if (result.success) { toast.success(`${prospect.clientCompanyName} sekarang kamu pegang`); router.refresh() }
      else toast.error(result.error ?? "Gagal mengambil prospek")
    })
  }

  const label = (prospect: ProspectListItem) => [prospect.clientCompanyName, prospect.contactName].filter(Boolean).join(" · ")
  const editable = (prospect: ProspectListItem) => canUpdate && canEditProspect(prospect, viewer)
  const workable = (prospect: ProspectListItem) => !prospect.missionId && (prospect.statusKind === "open" || prospect.statusKind === "in_progress")
  const isDue = (prospect: ProspectListItem) => workable(prospect) && !!prospect.nextContactAt && describeDueDate(prospect.nextContactAt, today).due && (prospect.ownerId === viewer.userId || prospect.ownerId === null)

  if (prospects.length === 0) {
    return filtered ? (
      <EmptyState title="Tidak ada prospek yang cocok" description="Longgarkan filter atau hapus salah satu untuk melihat lebih banyak." action={<Button asChild variant="outline" size="sm"><Link href="/workspace/prospects">Lihat semua prospek</Link></Button>} />
    ) : (
      <EmptyState
        title="Belum ada prospek"
        description={canCreate ? "Impor daftar calon klien dari Excel, atau tambahkan satu per satu. Setiap kontak yang dicatat dan janji temu yang berhasil akan terlihat di sini." : "Daftar calon klien yang sedang dihubungi akan muncul di sini."}
        action={canCreate ? <Button asChild size="sm"><Link href="/workspace/prospects/new"><Plus className="h-4 w-4" /> Prospek baru</Link></Button> : undefined}
      />
    )
  }

  const Actions = ({ prospect, size = "sm" }: { prospect: ProspectListItem; size?: "sm" | "default" }) => {
    const open = (
      <Link href={`/workspace/prospects/${prospect.id}`} aria-label={`Buka ${prospect.clientCompanyName}`} className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-8 md:w-8">
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    )
    const h = size === "default" ? "h-11" : ""
    const primary = prospect.missionId ? (
      <Button asChild size={size} variant="outline" className={h}>
        <Link href={`/workspace/missions/${prospect.missionId}`}>Buka mission</Link>
      </Button>
    ) : !editable(prospect) && canUpdate && prospect.ownerId === null ? null : editable(prospect) && workable(prospect) ? (
      <Button size={size} className={h} onClick={() => setAttemptTarget({ target: { ids: [prospect.id], label: label(prospect), prospectId: prospect.id }, statusId: prospect.statusId })}>
        <Phone className="h-4 w-4" /> Catat kontak
      </Button>
    ) : canUpdate && prospect.ownerId === null ? (
      <Button size={size} variant="outline" className={h} onClick={() => claim(prospect)} disabled={pending}>
        <UserPlus className="h-4 w-4" /> Ambil
      </Button>
    ) : null
    const menu = canUpdate || canDelete ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 md:h-8 md:w-8" aria-label={`Tindakan lain untuk ${prospect.clientCompanyName}`}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {editable(prospect) && !prospect.missionId && (
            <DropdownMenuItem onSelect={() => setStatusTarget({ ids: [prospect.id], label: label(prospect), prospectId: prospect.id })}>Ubah status</DropdownMenuItem>
          )}
          {editable(prospect) && !prospect.missionId && canCreateMission && prospect.statusKind !== "lost" && (
            <DropdownMenuItem asChild>
              <Link href={`/workspace/missions/new?prospect=${prospect.id}`}><CalendarCheck className="h-4 w-4" /> Jadwalkan kunjungan</Link>
            </DropdownMenuItem>
          )}
          {viewer.isAdmin && <DropdownMenuItem onSelect={() => setAssignTarget({ ids: [prospect.id], label: label(prospect) })}>Tugaskan</DropdownMenuItem>}
          {editable(prospect) && <DropdownMenuItem asChild><Link href={`/workspace/prospects/${prospect.id}/edit`}>Ubah</Link></DropdownMenuItem>}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-[var(--danger-foreground)] focus:text-[var(--danger-foreground)]" onSelect={() => { setSelected(new Set([prospect.id])); setBeyondPage(new Set()); setConfirmDelete(true) }}>
                <Trash2 className="h-4 w-4" /> Ke sampah
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null
    return (
      <span className="flex items-center justify-end gap-1.5">
        {primary}
        {menu}
        {open}
      </span>
    )
  }

  return (
    <>
      {selectable && chosen.length > 0 && (
        <SelectionBar
          count={chosen.length}
          onClear={clearSelection}
          onDelete={() => setConfirmDelete(true)}
          onStatus={() => setStatusTarget({ ids: chosen })}
          onAssign={() => setAssignTarget({ ids: chosen })}
          canDelete={canDelete}
          canAssign={viewer.isAdmin}
          allMatching={allChosen && moreMatch ? { total: pagination.total, pending: loadingAll, onSelect: selectAllMatching, selected: beyondPage.size > 0 } : undefined}
        />
      )}

      <ul className="space-y-3 md:hidden">
        {prospects.map((prospect) => {
          const ticked = selected.has(prospect.id)
          return (
            <li key={prospect.id} className={cn("rounded-xl border bg-card", isDue(prospect) && "border-l-4 border-l-[var(--warning-foreground)]", ticked && "border-primary bg-primary/5")}>
              <div className="flex">
                {selectable && (
                  <span className="grid w-11 shrink-0 place-items-start pl-3 pt-4">
                    <Checkbox checked={ticked} onCheckedChange={(value) => toggle(prospect.id, value === true)} aria-label={`Pilih ${prospect.clientCompanyName}`} />
                  </span>
                )}
                <Link href={`/workspace/prospects/${prospect.id}`} className={cn("block min-w-0 flex-1 p-4 transition-colors hover:bg-muted/50", selectable && "pl-2")}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-foreground">{prospect.clientCompanyName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[prospect.contactName, prospect.contactJobTitle].filter(Boolean).join(" · ") || "Belum ada kontak"}</span>
                    </span>
                    <span className="text-right"><ProspectStatusLabel prospect={prospect} /></span>
                  </div>
                  <p className="mt-3 text-sm text-foreground">{prospect.contactPhone ? formatPhone(prospect.contactPhone) : prospect.contactEmail ?? "—"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{[prospect.location, prospect.ownerName ?? "Belum ada pemegang"].filter(Boolean).join(" · ")}</p>
                  <span className="mt-2 block"><ContactLine prospect={prospect} today={today} /></span>
                </Link>
              </div>
              <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                <Actions prospect={prospect} size="default" />
              </div>
            </li>
          )
        })}
      </ul>

      <div className="hidden rounded-xl border bg-card md:block">
        <div className="data-table-scroll overflow-x-auto rounded-xl">
          <Table className="min-w-[880px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {selectable && (
                  <TableHead className="w-10">
                    <Checkbox checked={allChosen ? true : chosen.length > 0 ? "indeterminate" : false} onCheckedChange={(value) => toggleAll(value === true)} aria-label="Pilih semua prospek di halaman ini" />
                  </TableHead>
                )}
                <TableHead><Sort column="company" label="Perusahaan" sort={pagination.sort} /></TableHead>
                <TableHead><Sort column="contact" label="Kontak" sort={pagination.sort} /></TableHead>
                <TableHead><Sort column="status" label="Status" sort={pagination.sort} /></TableHead>
                <TableHead><Sort column="owner" label="Pemegang" sort={pagination.sort} /></TableHead>
                <TableHead><Sort column="created" label="Dibuat" sort={pagination.sort} /></TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prospects.map((prospect) => {
                const ticked = selected.has(prospect.id)
                return (
                  <TableRow key={prospect.id} data-state={ticked ? "selected" : undefined} className={cn(isDue(prospect) && "shadow-[inset_4px_0_0_0_var(--warning-foreground)]", ticked && "bg-primary/5")}>
                    {selectable && (
                      <TableCell>
                        <Checkbox checked={ticked} onCheckedChange={(value) => toggle(prospect.id, value === true)} aria-label={`Pilih ${prospect.clientCompanyName}`} />
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="block font-semibold text-foreground">{prospect.clientCompanyName}</span>
                      <span className="block text-xs text-muted-foreground">{[prospect.industry, prospect.location].filter(Boolean).join(" · ") || "—"}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="block text-foreground">{[prospect.contactSalutation, prospect.contactName].filter(Boolean).join(" ") || <span className="text-muted-foreground">Belum ada kontak</span>}</span>
                      <span className="block text-xs text-muted-foreground">{[prospect.contactPhone ? formatPhone(prospect.contactPhone) : null, prospect.contactEmail].filter(Boolean).join(" · ") || prospect.contactJobTitle || ""}</span>
                    </TableCell>
                    <TableCell>
                      <ProspectStatusLabel prospect={prospect} />
                      <ContactLine prospect={prospect} today={today} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {prospect.ownerName ? (
                        <span className="flex items-center gap-2"><PersonAvatar name={prospect.ownerName} avatarUrl={prospect.ownerAvatarUrl} size="sm" /><span className="truncate">{prospect.ownerName}</span></span>
                      ) : (
                        <span className="text-muted-foreground">Belum ada</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short" }).format(new Date(prospect.createdAt))}
                      {prospect.source === "import" && <span className="block text-xs">impor</span>}
                    </TableCell>
                    <TableCell className="w-px whitespace-nowrap"><Actions prospect={prospect} /></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <MissionPagination page={pagination.page} size={pagination.size} total={pagination.total} />
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border bg-card md:hidden">
        <MissionPagination page={pagination.page} size={pagination.size} total={pagination.total} />
      </div>

      <Dialog open={confirmDelete} onOpenChange={(next) => { if (!pending) setConfirmDelete(next) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pindahkan {chosen.length} prospek ke sampah?</DialogTitle>
            <DialogDescription>Prospek hilang dari daftar dan Hari ini, tetapi catatan kontaknya tetap tersimpan. Admin bisa memulihkannya dari Pengaturan → Sampah selama 30 hari.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={pending}>Kembali</Button>
            <Button onClick={remove} disabled={pending} className="bg-[var(--danger-foreground)] text-white hover:bg-[var(--danger-foreground)]/90">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Pindahkan ke sampah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChangeStatusDialog target={statusTarget} statuses={statuses} canCreateMission={canCreateMission} onClose={() => setStatusTarget(null)} />
      <LogAttemptDialog target={attemptTarget?.target ?? null} currentStatusId={attemptTarget?.statusId ?? null} statuses={statuses} canCreateMission={canCreateMission} onClose={() => setAttemptTarget(null)} />
      <AssignDialog target={assignTarget} people={people} viewerId={viewer.userId} onClose={() => setAssignTarget(null)} />
    </>
  )
}

function Sort({ column, label, sort }: { column: ProspectSortColumn; label: string; sort: ProspectSort }) {
  return (
    <SortHeader
      column={column}
      label={label}
      sort={sort}
      parts={prospectSortParts}
      next={nextProspectSort}
      defaultSort="due"
      defaultHint={{ column: "status", text: "jatuh tempo dulu" }}
    />
  )
}
