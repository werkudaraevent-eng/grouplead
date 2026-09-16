"use client"

import { useEffect, useState } from "react"
import { Check, Download, Upload } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { useStandalone } from "@/hooks/use-compact"
import { INSTALLABLE_EVENT, canPromptInstall, isIos, promptInstall } from "@/lib/pwa"

/**
 * How to put Sales Activity on the home screen, for this phone.
 *
 * Android and desktop Chrome hand us an install prompt; one button. iOS
 * installs from Safari's Share sheet, which no page can trigger, so the
 * steps are spelled out. An installed app sees a confirmation instead.
 */
export function InstallGuide() {
  const standalone = useStandalone()
  const [promptable, setPromptable] = useState(false)
  const [ios, setIos] = useState(false)
  const [outcome, setOutcome] = useState<"accepted" | "dismissed" | "unavailable" | null>(null)

  useEffect(() => {
    setIos(isIos())
    const update = () => setPromptable(canPromptInstall())
    update()
    window.addEventListener(INSTALLABLE_EVENT, update)
    return () => window.removeEventListener(INSTALLABLE_EVENT, update)
  }, [])

  if (standalone || outcome === "accepted") {
    return (
      <div className="rounded-xl border bg-card p-5">
        <p className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Check className="h-5 w-5 text-[var(--success-foreground)]" aria-hidden="true" /> Sudah terpasang
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Sales Activity terbuka dari layar utama, tanpa bilah alamat. Pembaruan diambil otomatis setiap kali dibuka.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <p className="text-base font-semibold text-foreground">Kenapa dipasang</p>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li>Ikon di layar utama, terbuka langsung ke Hari ini.</li>
          <li>Tanpa bilah alamat: lebih lega untuk jadwal dan form laporan.</li>
          <li>Kamera dan foto kunjungan bekerja seperti biasa.</li>
        </ul>
      </div>

      {ios ? (
        <div className="rounded-xl border bg-card p-5">
          <p className="text-base font-semibold text-foreground">Di iPhone (Safari)</p>
          <ol className="mt-3 space-y-3 text-sm text-foreground">
            <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--tonal)] text-xs font-bold text-[var(--tonal-foreground)]">1</span><span>Ketuk tombol <strong>Bagikan</strong> <Upload className="mx-1 inline h-4 w-4" aria-hidden="true" /> di bawah layar Safari.</span></li>
            <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--tonal)] text-xs font-bold text-[var(--tonal-foreground)]">2</span><span>Gulir dan pilih <strong>Tambahkan ke Layar Utama</strong>.</span></li>
            <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--tonal)] text-xs font-bold text-[var(--tonal-foreground)]">3</span><span>Ketuk <strong>Tambah</strong>. Ikon Sales Activity muncul di layar utama.</span></li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">Bila dibuka dari Chrome di iPhone, buka dulu alamat ini di Safari.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-5">
          <p className="text-base font-semibold text-foreground">Di Android (Chrome)</p>
          {promptable ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">Satu ketukan, lalu konfirmasi dari Chrome.</p>
              <Button
                className="mt-4 h-12 w-full sm:w-auto"
                onClick={async () => setOutcome(await promptInstall())}
              >
                <Download className="h-5 w-5" /> Pasang Sales Activity
              </Button>
              {outcome === "dismissed" && <p className="mt-2 text-sm text-muted-foreground">Dibatalkan. Bisa dipasang kapan saja dari halaman ini.</p>}
            </>
          ) : (
            <ol className="mt-3 space-y-3 text-sm text-foreground">
              <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--tonal)] text-xs font-bold text-[var(--tonal-foreground)]">1</span><span>Ketuk menu <strong>⋮</strong> di kanan atas Chrome.</span></li>
              <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--tonal)] text-xs font-bold text-[var(--tonal-foreground)]">2</span><span>Pilih <strong>Tambahkan ke layar utama</strong> atau <strong>Instal aplikasi</strong>.</span></li>
              <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--tonal)] text-xs font-bold text-[var(--tonal-foreground)]">3</span><span>Ketuk <strong>Instal</strong>.</span></li>
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
