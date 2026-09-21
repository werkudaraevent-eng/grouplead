"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2, RotateCcw } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { reannounce, setAnnouncementEnabled } from "@/app/actions/announcement-actions"
import type { AnnouncementState } from "@/lib/announcements/announcements"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"

const day = (iso: string) => new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short", year: "numeric" }).format(new Date(iso))
const stamp = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))

/**
 * One row per announceable release: the switch is the whole decision, the
 * secondary action re-announces. Re-announcing reaches every account, so it
 * asks once (M3 dialog for a consequence the person cannot take back).
 */
export function AnnouncementList({ items }: { items: AnnouncementState[] }) {
  const [rows, setRows] = useState(items)
  const [confirming, setConfirming] = useState<AnnouncementState | null>(null)
  const [pending, startTransition] = useTransition()

  const toggle = (item: AnnouncementState, enabled: boolean) => {
    setRows((prev) => prev.map((row) => (row.key === item.key ? { ...row, enabled } : row)))
    startTransition(async () => {
      const result = await setAnnouncementEnabled(item.key, enabled)
      if (!result.success) {
        setRows((prev) => prev.map((row) => (row.key === item.key ? { ...row, enabled: !enabled } : row)))
        toast.error(result.error ?? "Tidak bisa disimpan.")
      }
    })
  }

  const again = (item: AnnouncementState) => {
    startTransition(async () => {
      const result = await reannounce(item.key)
      if (!result.success) {
        toast.error(result.error ?? "Tidak bisa diumumkan ulang.")
        return
      }
      const now = new Date().toISOString()
      setRows((prev) => prev.map((row) => (row.key === item.key ? { ...row, enabled: true, announcedAt: now, configured: true } : row)))
      setConfirming(null)
      toast.success(`"${item.title}" diumumkan ulang ke semua akun.`)
    })
  }

  if (rows.length === 0) {
    return <p className="rounded-xl border bg-card px-5 py-6 text-sm text-muted-foreground">Belum ada rilis yang bisa diumumkan.</p>
  }

  return (
    <>
      <section className="overflow-clip rounded-xl border bg-card">
        <ul className="divide-y">
          {rows.map((item) => (
            <li key={item.key} className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <Label htmlFor={`announce-${item.key}`} className="text-sm font-semibold text-foreground">{item.title}</Label>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Rilis {day(`${item.date}T00:00:00+07:00`)}</span>
                  {item.configured && <span>· terakhir diumumkan {stamp(item.announcedAt)}</span>}
                  <button type="button" onClick={() => setConfirming(item)} disabled={pending} className="inline-flex min-h-8 items-center gap-1 font-semibold text-primary hover:underline disabled:opacity-50">
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Umumkan ulang
                  </button>
                </p>
              </div>
              {/* The hit area is the 48px row, not the 24px track. */}
              <span className="grid min-h-12 shrink-0 place-items-center">
                <Switch id={`announce-${item.key}`} checked={item.enabled} onCheckedChange={(next) => toggle(item, next)} disabled={pending} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={confirming !== null} onOpenChange={(open) => { if (!open && !pending) setConfirming(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Umumkan ulang ke semua akun?</DialogTitle>
            <DialogDescription>
              Dialog Yang baru untuk “{confirming?.title}” muncul lagi untuk setiap orang di unit ini saat mereka membuka Hari ini, termasuk yang sudah menutupnya.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirming(null)} disabled={pending}>Batal</Button>
            <Button type="button" onClick={() => confirming && again(confirming)} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Umumkan ulang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
