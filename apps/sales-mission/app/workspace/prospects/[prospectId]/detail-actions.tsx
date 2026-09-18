"use client"

import { useState } from "react"
import Link from "next/link"
import { CalendarCheck, MoreVertical, Trash2, UserPlus } from "@/components/icons"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import { assignProspects, deleteProspects } from "@/app/actions/prospect-actions"
import type { ProspectDetail } from "@/lib/prospects/prospect-schema"
import type { ProspectStatus } from "@/lib/prospects/prospect-status"
import type { Person } from "@/app/workspace/activities/new/people-picker"
import { canAssignOthers, type ProspectViewer } from "@/lib/prospects/prospect-access"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AssignDialog, ChangeStatusDialog, LogAttemptDialog, type DialogTarget } from "../prospect-dialogs"
import { ContactMenu } from "../contact-menu"
import { FollowUpPrompt } from "../follow-up-prompt"
import { addressContact, renderWhatsAppGreeting } from "@/lib/prospects/whatsapp-greeting"
import { paths } from "@/lib/paths"

/** The detail page's header actions: one filled, the rest in the overflow. */
export function ProspectDetailActions({
  prospect,
  statuses,
  people,
  viewer,
  editable,
  canUpdate,
  canDelete,
  canCreateMission,
  viewerName,
  companyName,
  whatsappGreeting,
}: {
  prospect: ProspectDetail
  statuses: ProspectStatus[]
  people: Person[]
  viewer: ProspectViewer
  editable: boolean
  canUpdate: boolean
  canDelete: boolean
  canCreateMission: boolean
  /** For the WhatsApp opening line: who is writing, from where, in the unit's words. */
  viewerName: string
  companyName: string
  whatsappGreeting: string | null
}) {
  const router = useRouter()
  const [attempt, setAttempt] = useState<DialogTarget | null>(null)
  const [status, setStatus] = useState<DialogTarget | null>(null)
  const [assign, setAssign] = useState<DialogTarget | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, start] = useTransition()
  const target: DialogTarget = { ids: [prospect.id], label: [prospect.clientCompanyName, prospect.contactName].filter(Boolean).join(" · "), prospectId: prospect.id }
  const workable = !prospect.missionId && (prospect.statusKind === "open" || prospect.statusKind === "in_progress")

  const claim = () =>
    start(async () => {
      const result = await assignProspects([prospect.id], viewer.userId)
      if (result.success) { toast.success("Prospek sekarang kamu pegang"); router.refresh() }
      else toast.error(result.error ?? "Gagal mengambil prospek")
    })

  const remove = () =>
    start(async () => {
      const result = await deleteProspects([prospect.id])
      if (result.success) { toast.success("Prospek dipindahkan ke sampah"); router.push("/workspace/prospects"); router.refresh() }
      else toast.error(result.error ?? "Gagal memindahkan ke sampah")
    })

  return (
    <>
      <span className="flex flex-wrap items-center gap-2">
        {prospect.missionId ? (
          <Button asChild variant="outline" size="sm"><Link href={paths.activity(prospect.missionId)}>Buka aktivitas</Link></Button>
        ) : editable && workable ? (
          <ContactMenu
            prospectId={prospect.id}
            label={target.label || prospect.clientCompanyName}
            statusId={prospect.statusId}
            phone={prospect.contactPhone}
            email={prospect.contactEmail}
            greeting={renderWhatsAppGreeting(whatsappGreeting, { contact: addressContact(prospect.contactSalutation, prospect.contactName), sales: viewerName, company: companyName })}
            onLog={() => setAttempt(target)}
          />
        ) : canUpdate && prospect.ownerId === null ? (
          <Button size="sm" variant="outline" onClick={claim} disabled={pending}><UserPlus className="h-4 w-4" /> Ambil</Button>
        ) : null}
        {(canUpdate || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Tindakan lain"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {editable && !prospect.missionId && <DropdownMenuItem onSelect={() => setStatus(target)}>Ubah status</DropdownMenuItem>}
              {editable && !prospect.missionId && canCreateMission && prospect.statusKind !== "lost" && (
                <DropdownMenuItem asChild><Link href={paths.newActivity({ prospect: prospect.id })}><CalendarCheck className="h-4 w-4" /> Jadwalkan kunjungan</Link></DropdownMenuItem>
              )}
              {canAssignOthers(viewer) && <DropdownMenuItem onSelect={() => setAssign(target)}>Tugaskan</DropdownMenuItem>}
              {editable && <DropdownMenuItem asChild><Link href={`/workspace/prospects/${prospect.id}/edit`}>Ubah</Link></DropdownMenuItem>}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-[var(--danger-foreground)] focus:text-[var(--danger-foreground)]" onSelect={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /> Ke sampah</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </span>

      <ChangeStatusDialog target={status} statuses={statuses} canCreateMission={canCreateMission} onClose={() => setStatus(null)} />
      <LogAttemptDialog target={attempt} currentStatusId={prospect.statusId} statuses={statuses} canCreateMission={canCreateMission} onClose={() => setAttempt(null)} />
      <FollowUpPrompt statuses={statuses} onDetail={(pending, prefill) => setAttempt({ ids: [pending.prospectId], label: pending.label, prospectId: pending.prospectId, prefill })} />
      <AssignDialog target={assign} people={people} viewerId={viewer.userId} onClose={() => setAssign(null)} />

      <Dialog open={confirmDelete} onOpenChange={(next) => { if (!pending) setConfirmDelete(next) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pindahkan prospek ke sampah?</DialogTitle>
            <DialogDescription>Prospek hilang dari daftar, catatan kontaknya tetap tersimpan. Admin bisa memulihkannya dari Pengaturan → Sampah selama 30 hari.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={pending}>Kembali</Button>
            <Button onClick={remove} disabled={pending} className="bg-[var(--danger-foreground)] text-white hover:bg-[var(--danger-foreground)]/90"><Trash2 className="h-4 w-4" /> Pindahkan ke sampah</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
