"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Loader2, Trash2 } from "@/components/icons"
import { clearAllMissions } from "@/app/actions/mission-actions"
import { CLEAR_ALL_PHRASE } from "@/lib/missions/clear-phrase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * Empty the missions, GitHub-style: the destructive control sits in its own
 * red-bordered zone, says exactly what it removes and how much, and only
 * arms once the person has typed the phrase. A checkbox is a reflex; a
 * sentence is a decision.
 */
export function ClearMissions({ count, canDelete }: { count: number; canDelete: boolean }) {
  const [typed, setTyped] = useState("")
  const [pending, start] = useTransition()
  const router = useRouter()
  const armed = typed.trim() === CLEAR_ALL_PHRASE && count > 0 && canDelete

  const run = () => {
    start(async () => {
      const result = await clearAllMissions(typed)
      if (result.success) {
        toast.success(`${result.data?.deleted ?? 0} aktivitas dipindahkan ke sampah. Daftar aktivitas sekarang kosong.`)
        setTyped("")
        router.refresh()
      } else {
        toast.error(result.error ?? "Data gagal dikosongkan.")
      }
    })
  }

  return (
    <section className="max-w-2xl overflow-clip rounded-xl border border-[var(--danger-foreground)]/30 bg-card">
      <header className="flex items-start gap-3 border-b border-[var(--danger-foreground)]/20 bg-[var(--danger)] px-5 py-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--danger-foreground)]" />
        <div>
          <h2 className="text-base font-semibold text-[var(--danger-foreground)]">Kosongkan semua aktivitas</h2>
          <p className="mt-0.5 text-sm text-[var(--danger-foreground)]">Zona berbahaya. Semuanya masuk ke sampah dulu.</p>
        </div>
      </header>

      <div className="space-y-4 px-5 py-5">
        <p className="text-sm leading-relaxed text-foreground">
          Memindahkan <strong>{count} mission</strong> beserta laporan kunjungan, penugasan, catatan pendukung, usulan
          jadwal, dan isian field tambahannya ke sampah. Pengaturan form, aturan mission, dan tautan papan tidak
          disentuh. Perusahaan dan kontak yang sudah masuk ke LeadEngine tetap ada di sana.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Dari sampah, admin bisa memulihkan atau menghapus permanen selama 30 hari. Riwayat perubahan mencatat
          setiap langkahnya.
        </p>

        {!canDelete && (
          <p className="rounded-md border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
            Peran Anda belum punya izin <em>hapus</em> pada modul Mission. Berikan dulu di LeadEngine → Pengaturan →
            Izin, atau minta super admin.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="clear-phrase" className="text-foreground">
            Ketik <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{CLEAR_ALL_PHRASE}</code> untuk mengaktifkan tombol
          </Label>
          <Input
            id="clear-phrase"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={!canDelete || count === 0}
            className="h-11 font-mono"
          />
        </div>

        <div className="flex justify-end">
          <Button
            onClick={run}
            disabled={!armed || pending}
            className="h-11 bg-[var(--danger-foreground)] text-white hover:bg-[var(--danger-foreground)]/90 disabled:opacity-40"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Pindahkan {count} mission ke sampah
          </Button>
        </div>
      </div>
    </section>
  )
}
