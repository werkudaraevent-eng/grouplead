"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RotateCw } from "@/components/icons"
import { Button } from "@/components/ui/button"

/**
 * Error state for every workspace page.
 *
 * These pages await Supabase on each request, so a dropped connection in the
 * field throws. Without this boundary the rep gets Next.js's bare "Application
 * error: a server-side exception has occurred" — a screen that names no cause
 * and offers no way forward.
 *
 * `reset()` re-runs the failed render, which is the right first move when the
 * cause was the connection rather than the data.
 */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Sales Mission workspace error:", error)
  }, [error])

  return (
    <div className="grid h-full w-full place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-xl border bg-card px-6 py-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--danger)] text-[var(--danger-foreground)]">
          <AlertTriangle className="h-6 w-6" />
        </span>

        <h1 className="mt-4 text-lg font-semibold text-foreground">Halaman ini gagal dimuat</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Biasanya karena koneksi terputus saat data diambil. Coba muat ulang — kalau masih gagal,
          periksa sinyal lalu buka lagi dari dashboard.
        </p>

        {/* The digest is what makes a report actionable in the server logs. */}
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">Kode: {error.digest}</p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset} className="h-11">
            <RotateCw className="h-4 w-4" /> Muat ulang
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link href="/workspace">Kembali ke dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
