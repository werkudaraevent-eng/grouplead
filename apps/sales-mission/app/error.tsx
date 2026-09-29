"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RotateCw } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { STALE_COPY, staleKind } from "@/lib/deploy/stale-client"

/**
 * Root error boundary, catching anything outside the workspace subtree: the
 * auth pages and the public board. Those have no shell to fall back into, so
 * this screen is standalone. A tab older than the deployment gets the
 * workspace's words for it and a full reload (see `app/workspace/error.tsx`).
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Sales Activity error:", error)
  }, [error])

  const stale = staleKind(error) !== null

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-xl border bg-card px-6 py-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--danger)] text-[var(--danger-foreground)]">
          <AlertTriangle className="h-6 w-6" />
        </span>

        <h1 className="mt-4 text-lg font-semibold text-foreground">{stale ? STALE_COPY.screenTitle : "Terjadi kesalahan"}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {stale ? STALE_COPY.screenBody : "Halaman ini tidak bisa ditampilkan. Coba muat ulang, atau kembali ke halaman masuk."}
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">Kode: {error.digest}</p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={stale ? () => window.location.reload() : reset} className="h-11">
            <RotateCw className="h-4 w-4" /> Muat ulang
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link href="/login">Ke halaman masuk</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
