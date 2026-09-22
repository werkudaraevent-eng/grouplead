"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Ban, Loader2 } from "@/components/icons"
import { cancelMission } from "@/app/actions/mission-actions"
import { AutoTextarea } from "@/components/ui/auto-textarea"
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
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { cn } from "@/lib/utils"

/**
 * Call the visit off before it happens.
 *
 * Distinct from a visit that failed on site (client absent, cancelled at the
 * door), which is a visit report with that outcome: the rep went, and that is
 * worth recording. This is for the morning phone call. It asks why, because
 * "dibatalkan" with no reason tells the appointment team nothing about
 * whether to try again, and it asks which kind of off this is: gone, or
 * postponed with a day by which the rep will call the client for a new date.
 * A postponed visit stays on Hari ini until a new one is scheduled from it.
 */

type Mode = "cancel" | "postpone"

/** Today plus `days`, as a YYYY-MM-DD in Werkudara's timezone. */
function dayAfter(days: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(new Date(Date.now() + days * 86_400_000))
}

export function CancelMissionButton({
  missionId,
  clientName,
  open: controlledOpen,
  onOpenChange,
  trigger = true,
}: {
  missionId: string
  clientName: string
  /** Owned from outside when the opener is elsewhere (the phone's overflow menu). */
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
  const [mode, setMode] = useState<Mode>("cancel")
  const [reason, setReason] = useState("")
  const [followUpOn, setFollowUpOn] = useState(() => dayAfter(3))
  const [pending, start] = useTransition()
  const router = useRouter()

  const postpone = mode === "postpone"
  const ready = reason.trim().length > 0 && (!postpone || /^\d{4}-\d{2}-\d{2}$/.test(followUpOn))

  const confirm = () => {
    start(async () => {
      const result = await cancelMission(missionId, reason, { followUpOn: postpone ? followUpOn : null })
      if (result.success) {
        toast.success(postpone ? "Aktivitas ditunda. Muncul di Hari ini sampai dijadwalkan lagi." : "Aktivitas dibatalkan. Tim sudah diberi tahu.")
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error ?? "Aktivitas gagal dibatalkan.")
      }
    })
  }

  const options: Array<{ value: Mode; title: string; detail: string }> = [
    { value: "cancel", title: "Batal, tidak ada lanjutan", detail: "Kunjungan ini tidak akan terjadi." },
    { value: "postpone", title: "Ditunda, jadwal menyusul", detail: "Klien minta hari lain; tanggalnya belum ada. Muncul di Hari ini sampai dijadwalkan lagi." },
  ]

  return (
    <>
      {trigger && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="text-[var(--danger-foreground)] hover:text-[var(--danger-foreground)]"
        >
          <Ban className="h-4 w-4" /> Batalkan aktivitas
        </Button>
      )}

      <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Batalkan kunjungan ke {clientName}?</DialogTitle>
            <DialogDescription>
              Untuk kunjungan yang belum berangkat. Kalau Anda sudah di lokasi dan klien tidak ada,
              isi laporan kunjungan dengan hasil itu; kunjungannya tetap tercatat.
            </DialogDescription>
          </DialogHeader>

          {/* Two radio list items (Material list + radio), not a select: both
              answers must be readable before choosing. */}
          <fieldset className="space-y-2">
            <legend className="sr-only">Jenis pembatalan</legend>
            {options.map((option) => {
              const checked = mode === option.value
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    checked ? "border-primary bg-primary/8" : "border-input hover:bg-muted/60"
                  )}
                >
                  <input
                    type="radio"
                    name="cancel-mode"
                    value={option.value}
                    checked={checked}
                    onChange={() => setMode(option.value)}
                    className="mt-1 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{option.title}</span>
                    <span className="block text-xs text-muted-foreground">{option.detail}</span>
                  </span>
                </label>
              )
            })}
          </fieldset>

          {postpone && (
            <div className="space-y-1.5">
              <Label htmlFor="cancel-follow-up" className="text-foreground">
                Hubungi klien lagi paling lambat<span className="ml-0.5 text-[var(--danger-foreground)]" aria-hidden="true">*</span>
              </Label>
              <input
                id="cancel-follow-up"
                type="date"
                value={followUpOn}
                min={dayAfter(0)}
                onChange={(event) => setFollowUpOn(event.target.value)}
                className="h-11 w-full rounded-md border border-input bg-field px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-9"
              />
              <p className="text-xs text-muted-foreground">
                Tanggal janji Anda menelepon klien untuk jadwal baru, bukan tanggal kunjungannya.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason" className="text-foreground">
              Alasan<span className="ml-0.5 text-[var(--danger-foreground)]" aria-hidden="true">*</span>
            </Label>
            <AutoTextarea
              id="cancel-reason"
              minRows={2}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Klien minta ditunda, sales berhalangan, dan sebagainya."
            />
            <p className="text-xs text-muted-foreground">
              Dicatat di riwayat aktivitas dan di CRM, supaya tim appointment tahu apa yang terjadi.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Kembali</Button>
            <Button
              onClick={confirm}
              disabled={pending || !ready}
              className="bg-[var(--danger-foreground)] text-white hover:bg-[var(--danger-foreground)]/90"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              {postpone ? "Tunda aktivitas" : "Batalkan aktivitas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
