"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Ban, Loader2 } from "@/components/icons"
import { cancelMission } from "@/app/actions/mission-actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

/**
 * Call the visit off before it happens.
 *
 * Distinct from a visit that failed on site (client absent, cancelled at the
 * door), which is a visit report with that outcome: the rep went, and that is
 * worth recording. This is for the morning phone call. It asks why, because
 * "dibatalkan" with no reason tells the appointment team nothing about
 * whether to try again.
 */
export function CancelMissionButton({ missionId, clientName }: { missionId: string; clientName: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [pending, start] = useTransition()
  const router = useRouter()

  const confirm = () => {
    start(async () => {
      const result = await cancelMission(missionId, reason)
      if (result.success) {
        toast.success("Aktivitas dibatalkan. Tim sudah diberi tahu.")
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error ?? "Aktivitas gagal dibatalkan.")
      }
    })
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-[var(--danger-foreground)] hover:text-[var(--danger-foreground)]"
      >
        <Ban className="h-4 w-4" /> Batalkan aktivitas
      </Button>

      <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Batalkan kunjungan ke {clientName}?</DialogTitle>
            <DialogDescription>
              Untuk kunjungan yang belum berangkat. Kalau Anda sudah di lokasi dan klien tidak ada,
              isi laporan kunjungan dengan hasil itu; kunjungannya tetap tercatat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason" className="text-foreground">
              Alasan<span className="ml-0.5 text-[var(--danger-foreground)]" aria-hidden="true">*</span>
            </Label>
            <textarea
              id="cancel-reason"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Klien minta ditunda, sales berhalangan, dan sebagainya."
              className="w-full rounded-md border border-input bg-field px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <p className="text-xs text-muted-foreground">
              Dicatat di riwayat aktivitas dan di CRM, supaya tim appointment tahu apakah perlu dijadwalkan lagi.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Kembali</Button>
            <Button
              onClick={confirm}
              disabled={pending || !reason.trim()}
              className="bg-[var(--danger-foreground)] text-white hover:bg-[var(--danger-foreground)]/90"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Batalkan aktivitas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
