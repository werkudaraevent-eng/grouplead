"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, MessageCircle, Undo2 } from "@/components/icons"
import { requestReportClarification, withdrawVisitReport } from "@/app/actions/visit-report-actions"
import { AutoTextarea } from "@/components/ui/auto-textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * "Minta klarifikasi": an admin sends a sent report back to its author with a
 * note. A dialog, because it needs one input and a decision; the note is
 * required because a report returned without a reason is a puzzle.
 */
export function RequestClarificationButton({
  missionId,
  authorName,
  open: controlledOpen,
  onOpenChange,
  trigger = true,
}: {
  missionId: string
  authorName: string | null
  /** Owned from outside when the opener is elsewhere (the report card's overflow menu). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Whether to render the button itself. */
  trigger?: boolean
}) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = controlledOpen ?? ownOpen
  const setOpen = (next: boolean) => {
    setOwnOpen(next)
    onOpenChange?.(next)
  }
  const [note, setNote] = useState("")
  const [pending, start] = useTransition()
  const router = useRouter()

  const send = () =>
    start(async () => {
      const result = await requestReportClarification(missionId, note)
      if (!result.success) {
        toast.error(result.error ?? "Permintaan gagal dikirim.")
        return
      }
      toast.success(authorName ? `Laporan dikembalikan ke ${authorName}.` : "Laporan dikembalikan ke sales utama.")
      setOpen(false)
      setNote("")
      router.refresh()
    })

  return (
    <>
      {trigger && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <MessageCircle className="h-4 w-4" /> Minta klarifikasi
        </Button>
      )}
      <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Minta klarifikasi</DialogTitle>
            <DialogDescription>
              Laporan dikembalikan ke {authorName ?? "sales utama"} dengan catatan ini. Isinya tetap tersimpan; mereka memperbaiki lalu mengirim ulang, dan versi yang sekarang masuk riwayat.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-1.5">
            <Label htmlFor="clarification-note" className="text-foreground">Apa yang perlu diperbaiki</Label>
            <AutoTextarea
              id="clarification-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              minRows={3}
              maxLength={500}
              autoFocus
              placeholder="Contoh: nilai estimasi sepertinya kurang satu nol, dan kontak yang ditemui belum ada jabatannya."
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button>
            <Button onClick={send} disabled={pending || note.trim().length < 5}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Kembalikan laporan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * "Tarik kembali": undo a send. The report becomes a draft again (its
 * content kept), the mission is no longer Selesai, the sent version is
 * archived with the reason. A dialog, because it is a decision with one
 * required input; the copy says what does and does not come back.
 */
export function WithdrawReportButton({
  missionId,
  leadPushed,
  open: controlledOpen,
  onOpenChange,
  trigger = true,
}: {
  missionId: string
  leadPushed: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: boolean
}) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = controlledOpen ?? ownOpen
  const setOpen = (next: boolean) => {
    setOwnOpen(next)
    onOpenChange?.(next)
  }
  const [reason, setReason] = useState("")
  const [pending, start] = useTransition()
  const router = useRouter()

  const withdraw = () =>
    start(async () => {
      const result = await withdrawVisitReport(missionId, reason)
      if (!result.success) {
        toast.error(result.error ?? "Laporan gagal ditarik kembali.")
        return
      }
      toast.success("Laporan ditarik kembali. Aktivitas tidak lagi Selesai; drafnya tetap ada.")
      setOpen(false)
      setReason("")
      router.refresh()
    })

  return (
    <>
      {trigger && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Undo2 className="h-4 w-4" /> Tarik kembali
        </Button>
      )}
      <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tarik kembali laporan ini?</DialogTitle>
            <DialogDescription>
              Laporan kembali menjadi draf dengan isi yang sama, dan aktivitas tidak lagi Selesai. Versi yang terkirim tersimpan di riwayat bersama alasannya, dan tim diberi tahu.
              {leadPushed && " Lead yang sudah dikirim ke LeadEngine tetap ada di sana; urus di CRM bila perlu."}
              {" "}Kalau laporannya memang tidak diinginkan, buang drafnya setelah ini.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-1.5">
            <Label htmlFor="withdraw-reason" className="text-foreground">Alasan</Label>
            <AutoTextarea
              id="withdraw-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minRows={2}
              maxLength={500}
              autoFocus
              placeholder="Contoh: laporan uji coba, atau terkirim untuk kunjungan yang salah."
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button>
            <Button onClick={withdraw} disabled={pending || reason.trim().length < 5}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Tarik kembali
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
