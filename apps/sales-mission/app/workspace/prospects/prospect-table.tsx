"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { ViewLink } from "@/components/remember-view"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowUpRight, CalendarCheck, Loader2, MoreVertical, Plus, Trash2, UserPlus, X } from "@/components/icons"
import { deleteProspects, assignProspects, matchingProspectIds } from "@/app/actions/prospect-actions"
import { MissionPagination } from "@/app/workspace/activities/mission-pagination"
import { SortHeader } from "@/components/sort-header"
import { nextProspectSort, prospectSortParts, type ProspectSort, type ProspectSortColumn } from "@/lib/prospects/prospect-paging"
import { COLOR_DOT, displayStatus, type ProspectStatus } from "@/lib/prospects/prospect-status"
import { describeDueDate, type ProspectListItem } from "@/lib/prospects/prospect-schema"
import { canAssignOthers, canEditProspect, type ProspectViewer } from "@/lib/prospects/prospect-access"
import { formatPhone } from "@/lib/format/phone"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { EmptyState } from "@/app/workspace/workspace-page"
import { PersonAvatar } from "@/components/person-avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ResponsiveMenu } from "@/components/responsive-menu"
import { useSelectionMode } from "@/components/selection-mode"
import { SelectableCardBody } from "@/components/selectable-card-body"
import { TeamFacepile } from "@/components/team-facepile"
import { ContactMenu } from "./contact-menu"
import { FollowUpPrompt } from "./follow-up-prompt"
import { addressContact, renderWhatsAppGreeting } from "@/lib/prospects/whatsapp-greeting"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { AssignDialog, ChangeStatusDialog, LogAttemptDialog, type DialogTarget } from "./prospect-dialogs"
import type { Person } from "@/app/workspace/activities/new/people-picker"
import { paths } from "@/lib/paths"

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
  // An open status with no attempts already says it in its label.
  if (prospect.statusKind === "open") return null
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
        {count > 0 ? (
          <span className="font-semibold">{count} prospek dipilih</span>
        ) : (
          <span className="text-muted-foreground">Ketuk prospek untuk memilih</span>
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
      <span className="flex flex-wrap items-center gap-2">
        {canAssign && (
          <Button size="sm" variant="outline" onClick={onAssign} disabled={count === 0}>
            <UserPlus className="h-4 w-4" /> Tugaskan ke
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onStatus} disabled={count === 0}>Ubah status</Button>
        {canDelete && (
          <Button size="sm" variant="outline" onClick={onDelete} disabled={count === 0} className="text-[var(--danger-foreground)] hover:text-[var(--danger-foreground)]">
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
  viewerName,
  companyName,
  whatsappGreeting,
}: {
  prospects: ProspectListItem[]
  statuses: ProspectStatus[]
  people: Person[]
  today: string
  viewer: ProspectViewer
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  canCreateMission: boolean
  filtered: boolean
  pagination: { page: number; size: number; total: number; sort: ProspectSort }
  /** For the WhatsApp opening line: who is writing, from where, in the unit's words. */
  viewerName: string
  companyName: string
  whatsappGreeting: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [beyondPage, setBeyondPage] = useState<Set<string>>(new Set())
  // The phone's cards show their checkboxes only in this mode; the desk's
  // table always does.
  const { selecting, setSelecting } = useSelectionMode()
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

  const clearSelection = () => { setSelected(new Set()); setBeyondPage(new Set()); setSelecting(false) }
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
        toast.success(`${result.data?.deleted ?? chosen.length} prospek dipindahkan ke sampah${result.data?.skipped ? `, ${result.data.skipped} dilewati` : ""}`)
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
      <EmptyState title="Tidak ada prospek yang cocok" description="Longgarkan filter atau hapus salah satu untuk melihat lebih banyak." action={<Button asChild variant="outline" size="sm"><ViewLink list="prospects" href={paths.prospects}>Lihat semua prospek</ViewLink></Button>} />
    ) : (
      <EmptyState
        title={canCreate ? "Mulai dari daftar calon klien" : "Belum ada prospek"}
        description={canCreate ? "Prospek adalah calon klien yang sedang dihubungi, sebelum ada janji temu." : "Daftar calon klien yang sedang dihubungi akan muncul di sini."}
        steps={
          canCreate
            ? [
                "Impor dari Excel, atau tambah satu per satu",
                "Catat setiap kontak; tanggal hubungi lagi muncul di Hari ini",
                "Janji temu yang jadi: jadwalkan aktivitas langsung dari prospeknya",
              ]
            : undefined
        }
        action={canCreate ? <Button asChild size="sm"><Link href="/workspace/prospects/new"><Plus className="h-4 w-4" /> Prospek baru</Link></Button> : undefined}
        learnHref={paths.guideSection("prospek")}
      />
    )
  }

  // `showOpen`: the arrow into the record, for the table, whose row is not
  // a link; a card's body already is one.
  const Actions = ({ prospect, size = "sm", showOpen = true }: { prospect: ProspectListItem; size?: "sm" | "default"; showOpen?: boolean }) => {
    const open = showOpen && (
      <Link href={`/workspace/prospects/${prospect.id}`} aria-label={`Buka ${prospect.clientCompanyName}`} className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-8 md:w-8">
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    )
    const h = size === "default" ? "h-11" : ""
    const primary = prospect.missionId ? (
      <Button asChild size={size} variant="outline" className={h}>
        <Link href={paths.activity(prospect.missionId)}>Buka aktivitas</Link>
      </Button>
    ) : !editable(prospect) && canUpdate && prospect.ownerId === null ? null : editable(prospect) && workable(prospect) ? (
      <ContactMenu
        prospectId={prospect.id}
        label={label(prospect)}
        statusId={prospect.statusId}
        phone={prospect.contactPhone}
        email={prospect.contactEmail}
        greeting={renderWhatsAppGreeting(whatsappGreeting, { contact: addressContact(prospect.contactSalutation, prospect.contactName), sales: viewerName, company: companyName })}
        size={size}
        className={h}
        onLog={() => setAttemptTarget({ target: { ids: [prospect.id], label: label(prospect), prospectId: prospect.id }, statusId: prospect.statusId })}
      />
    ) : canUpdate && prospect.ownerId === null ? (
      <Button size={size} variant="outline" className={h} onClick={() => claim(prospect)} disabled={pending}>
        <UserPlus className="h-4 w-4" /> Ambil
      </Button>
    ) : null
    const menu = canUpdate || canDelete ? (
      <ResponsiveMenu
        title={label(prospect)}
        trigger={
          <Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8" aria-label={`Tindakan lain untuk ${prospect.clientCompanyName}`}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        }
        items={[
          editable(prospect) && !prospect.missionId && { label: "Ubah status", onSelect: () => setStatusTarget({ ids: [prospect.id], label: label(prospect), prospectId: prospect.id }) },
          editable(prospect) && !prospect.missionId && canCreateMission && prospect.statusKind !== "lost" && { label: "Jadwalkan kunjungan", icon: CalendarCheck, href: paths.newActivity({ prospect: prospect.id }) },
          canAssignOthers(viewer) && { label: "Tugaskan", onSelect: () => setAssignTarget({ ids: [prospect.id], label: label(prospect) }) },
          editable(prospect) && { label: "Ubah", href: `/workspace/prospects/${prospect.id}/edit` },
          canDelete && { kind: "divider" as const },
          canDelete && { label: "Ke sampah", icon: Trash2, danger: true, onSelect: () => { setSelected(new Set([prospect.id])); setBeyondPage(new Set()); setConfirmDelete(true) } },
        ]}
      />
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
      {selectable && (chosen.length > 0 || selecting) && (
        <SelectionBar
          count={chosen.length}
          onClear={clearSelection}
          onDelete={() => setConfirmDelete(true)}
          onStatus={() => setStatusTarget({ ids: chosen })}
          onAssign={() => setAssignTarget({ ids: chosen })}
          canDelete={canDelete}
          canAssign={canAssignOthers(viewer)}
          allMatching={allChosen && moreMatch ? { total: pagination.total, pending: loadingAll, onSelect: selectAllMatching, selected: beyondPage.size > 0 } : undefined}
        />
      )}

      {/* Mobile gets cards, not a squeezed table. The body is the link; a
          long press enters selection mode (`SelectableCardBody`). How to
          reach the contact and where they are share one line, who holds
          the prospect sits under it. */}
      <ul className="space-y-3 md:hidden">
        {prospects.map((prospect) => {
          const ticked = selected.has(prospect.id)
          const picking = selectable && selecting
          return (
            <li key={prospect.id} className={cn("rounded-xl border bg-card", isDue(prospect) && "border-l-4 border-l-[var(--warning-foreground)]", ticked && "border-primary bg-primary/5")}>
              <div className="flex">
                {picking && (
                  <span className="grid w-11 shrink-0 place-items-start pl-3 pt-4">
                    <Checkbox checked={ticked} onCheckedChange={(value) => toggle(prospect.id, value === true)} aria-label={`Pilih ${prospect.clientCompanyName}`} />
                  </span>
                )}
                <SelectableCardBody
                  href={`/workspace/prospects/${prospect.id}`}
                  selecting={picking}
                  ticked={ticked}
                  onTick={(next) => toggle(prospect.id, next)}
                  onLongPress={() => { setSelecting(true); toggle(prospect.id, true) }}
                  enabled={selectable}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-foreground">{prospect.clientCompanyName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[prospect.contactName, prospect.contactJobTitle].filter(Boolean).join(" · ") || "Belum ada kontak"}</span>
                    </span>
                    <span className="text-right"><ProspectStatusLabel prospect={prospect} /></span>
                  </div>
                  <p className="mt-2 truncate text-sm text-foreground">
                    {[prospect.contactPhone ? formatPhone(prospect.contactPhone) : prospect.contactEmail, prospect.location].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <span className="mt-1.5 block"><ContactLine prospect={prospect} today={today} /></span>
                </SelectableCardBody>
              </div>
              {/* Who holds it at bottom-start, what to do at bottom-end. */}
              <div className="flex min-h-11 items-center justify-between gap-3 border-t px-3 py-2">
                <TeamFacepile people={prospect.ownerName ? [{ name: prospect.ownerName, avatarUrl: prospect.ownerAvatarUrl }] : []} empty="Belum ada pemegang" />
                <Actions prospect={prospect} size="default" showOpen={false} />
              </div>
            </li>
          )
        })}
      </ul>

      <div className="hidden rounded-xl border bg-card md:block">
        <div className="data-table-scroll overflow-x-auto rounded-xl">
          {/*
            Fixed layout, so the width of a column is decided here and not by
            whichever cell happens to hold the longest unbreakable string. The
            two identifier columns (company, contact) take whatever is left;
            the rest have a set width sized to their content. Lower-priority
            columns leave at narrower widths before anything scrolls: the
            owner below xl, the created date below 2xl. Long text truncates
            with the full value on hover; the detail page has the rest.
          */}
          <Table className="min-w-[960px] table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {selectable && (
                  <TableHead className="w-10">
                    <Checkbox checked={allChosen ? true : chosen.length > 0 ? "indeterminate" : false} onCheckedChange={(value) => toggleAll(value === true)} aria-label="Pilih semua prospek di halaman ini" />
                  </TableHead>
                )}
                <TableHead><Sort column="company" label="Perusahaan" sort={pagination.sort} /></TableHead>
                <TableHead><Sort column="contact" label="Kontak" sort={pagination.sort} /></TableHead>
                {/* Widths on the header cells, not a <colgroup>: Chrome ignores
                    display:none on a <col>, so a hidden column's width was still
                    handed out one column over (see the mission table). */}
                <TableHead className="w-[200px]"><Sort column="status" label="Status" sort={pagination.sort} /></TableHead>
                <TableHead className="hidden w-[200px] xl:table-cell"><Sort column="owner" label="Pemegang" sort={pagination.sort} /></TableHead>
                <TableHead className="hidden w-[88px] 2xl:table-cell"><Sort column="created" label="Dibuat" sort={pagination.sort} /></TableHead>
                <TableHead className="w-[210px] text-right">Aksi</TableHead>
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
                      <Link href={`/workspace/prospects/${prospect.id}`} className="block truncate font-semibold text-foreground hover:underline" title={prospect.clientCompanyName}>{prospect.clientCompanyName}</Link>
                      <span className="block truncate text-xs text-muted-foreground" title={[prospect.industry, prospect.location].filter(Boolean).join(" · ") || undefined}>{[prospect.industry, prospect.location].filter(Boolean).join(" · ") || "—"}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="block truncate text-foreground">{[prospect.contactSalutation, prospect.contactName].filter(Boolean).join(" ") || <span className="text-muted-foreground">Belum ada kontak</span>}</span>
                      <span className="block truncate text-xs text-muted-foreground" title={[prospect.contactPhone ? formatPhone(prospect.contactPhone) : null, prospect.contactEmail].filter(Boolean).join(" · ") || undefined}>{[prospect.contactPhone ? formatPhone(prospect.contactPhone) : null, prospect.contactEmail].filter(Boolean).join(" · ") || prospect.contactJobTitle || ""}</span>
                    </TableCell>
                    <TableCell>
                      <ProspectStatusLabel prospect={prospect} />
                      <ContactLine prospect={prospect} today={today} />
                    </TableCell>
                    <TableCell className="hidden text-sm xl:table-cell">
                      {prospect.ownerName ? (
                        <span className="flex items-center gap-2"><PersonAvatar name={prospect.ownerName} avatarUrl={prospect.ownerAvatarUrl} size="sm" /><span className="truncate" title={prospect.ownerName}>{prospect.ownerName}</span></span>
                      ) : (
                        <span className="text-muted-foreground">Belum ada</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground 2xl:table-cell">
                      {new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short" }).format(new Date(prospect.createdAt))}
                      {prospect.source === "import" && <span className="block text-xs">impor</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap"><Actions prospect={prospect} /></TableCell>
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
      <FollowUpPrompt statuses={statuses} onDetail={(pending, prefill) => setAttemptTarget({ target: { ids: [pending.prospectId], label: pending.label, prospectId: pending.prospectId, prefill }, statusId: pending.statusId })} />
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
