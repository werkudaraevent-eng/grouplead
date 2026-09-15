"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, MessageCircle } from "@/components/icons"
import { requestReportClarification } from "@/app/actions/visit-report-actions"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * "Minta klarifikasi": an admin sends a sent report back to its author with a
 * note. A dialog, because it needs one input and a decision; the note is
 * required because a report returned without a reason is a puzzle.
 */
export function RequestClarificationButton({ missionId, authorName }: { missionId: string; authorName: string | null }) {
  const [open, setOpen] = useState(false)
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
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <MessageCircle className="h-4 w-4" /> Minta klarifikasi
      </Button>
      <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Minta klarifikasi</DialogTitle>
            <DialogDescription>
              Laporan dikembalikan ke {authorName ?? "sales utama"} dengan catatan ini. Isinya tetap tersimpan; mereka memperbaiki lalu mengirim ulang, dan versi yang sekarang masuk riwayat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="clarification-note" className="text-foreground">Apa yang perlu diperbaiki</Label>
            <textarea
              id="clarification-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              maxLength={500}
              autoFocus
              placeholder="Contoh: nilai estimasi sepertinya kurang satu nol, dan kontak yang ditemui belum ada jabatannya."
              className="w-full rounded-md border border-input bg-field px-3 py-2.5 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
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
