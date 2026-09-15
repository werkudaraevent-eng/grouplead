"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, RotateCcw, Trash2, X } from "@/components/icons"
import { emptyProspectBin, purgeProspects, restoreProspects } from "@/app/actions/recycle-bin-actions"
import type { DeletedProspect } from "@/lib/prospects/prospect-bin-queries"
import { daysLeft } from "@/lib/missions/recycle-bin"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

/** The prospect half of the bin: same shape as the mission list above it. */
export function ProspectBinList({ items, now }: { items: DeletedProspect[]; now: string }) {
  const router = useRouter()
  const [chosen, setChosen] = useState<string[]>([])
  const [confirm, setConfirm] = useState<"purge" | "empty" | null>(null)
  const [pending, start] = useTransition()
  const nowDate = new Date(now)
  const stamp = (iso: string) => new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
  const toggle = (id: string, on: boolean) => setChosen((list) => (on ? [...new Set([...list, id])] : list.filter((item) => item !== id)))
  const allChosen = items.length > 0 && chosen.length === items.length

  const run = (work: () => Promise<{ success: boolean; error?: string; data?: { restored?: number; purged?: number } }>, done: (n: number) => string) =>
    start(async () => {
      const result = await work()
      if (!result.success) { toast.error(result.error ?? "Gagal."); return }
      toast.success(done(result.data?.restored ?? result.data?.purged ?? 0))
      setChosen([]); setConfirm(null); router.refresh()
    })

  if (items.length === 0) return <p className="rounded-xl border border-dashed bg-card/50 px-5 py-6 text-sm text-muted-foreground">Tidak ada prospek di sampah.</p>

  return (
    <>
      <div className="mb-3 flex min-h-12 flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-2">
        {chosen.length > 0 ? (
          <>
            <span className="text-sm font-semibold text-foreground">{chosen.length} dipilih</span>
            <span className="ml-auto flex items-center gap-2">
              <Button size="sm" onClick={() => run(() => restoreProspects(chosen), (n) => `${n} prospek dipulihkan`)} disabled={pending}><RotateCcw className="h-4 w-4" /> Pulihkan</Button>
              <Button size="sm" variant="outline" className="text-[var(--danger-foreground)] hover:text-[var(--danger-foreground)]" onClick={() => setConfirm("purge")} disabled={pending}><Trash2 className="h-4 w-4" /> Hapus permanen</Button>
              <Button size="sm" variant="ghost" onClick={() => setChosen([])} aria-label="Batalkan pilihan"><X className="h-4 w-4" /> Batal</Button>
            </span>
          </>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">{items.length} prospek di sampah</span>
            <Button size="sm" variant="outline" className="ml-auto text-[var(--danger-foreground)] hover:text-[var(--danger-foreground)]" onClick={() => setConfirm("empty")} disabled={pending}><Trash2 className="h-4 w-4" /> Kosongkan</Button>
          </>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10"><Checkbox checked={allChosen ? true : chosen.length > 0 ? "indeterminate" : false} onCheckedChange={(value) => setChosen(value === true ? items.map((item) => item.id) : [])} aria-label="Pilih semua prospek" /></TableHead>
                <TableHead>Prospek</TableHead>
                <TableHead>Dihapus</TableHead>
                <TableHead className="text-right">Sisa waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const left = daysLeft(item.deletedAt, nowDate)
                return (
                  <TableRow key={item.id} data-state={chosen.includes(item.id) ? "selected" : undefined}>
                    <TableCell><Checkbox checked={chosen.includes(item.id)} onCheckedChange={(value) => toggle(item.id, value === true)} aria-label={`Pilih ${item.clientCompanyName}`} /></TableCell>
                    <TableCell><span className="block font-semibold text-foreground">{item.clientCompanyName}</span><span className="block text-xs text-muted-foreground">{[item.contactName, item.location].filter(Boolean).join(" · ")}</span></TableCell>
                    <TableCell><span className="block text-sm text-foreground">{stamp(item.deletedAt)}</span><span className="block text-xs text-muted-foreground">{item.deletedByName ?? "—"}</span></TableCell>
                    <TableCell className={cn("text-right text-sm tabular-nums", left <= 3 ? "text-[var(--danger-foreground)]" : "text-muted-foreground")}>{left === 0 ? "hari ini" : `${left} hari`}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      <Dialog open={confirm !== null} onOpenChange={(open) => { if (!pending && !open) setConfirm(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm === "empty" ? `Hapus permanen ${items.length} prospek di sampah?` : `Hapus permanen ${chosen.length} prospek?`}</DialogTitle>
            <DialogDescription>Catatan kontaknya ikut terhapus. Riwayat aktivitas tetap mencatat isinya. Tidak bisa dibatalkan.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={pending}>Kembali</Button>
            <Button onClick={() => (confirm === "empty" ? run(() => emptyProspectBin(), (n) => `${n} prospek dihapus permanen`) : run(() => purgeProspects(chosen), (n) => `${n} prospek dihapus permanen`))} disabled={pending} className="bg-[var(--danger-foreground)] text-white hover:bg-[var(--danger-foreground)]/90">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Hapus permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
