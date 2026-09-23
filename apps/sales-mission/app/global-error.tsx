"use client"

import { useEffect, useState } from "react"
import "./globals.css"

/**
 * The last net: an error that escapes every page and layout boundary.
 *
 * Without this file Next.js shows its own bare English sentence,
 * "Application error: a client-side exception has occurred", with no way
 * forward. The errors that reach here are almost never the page's own: a
 * tab that kept the previous build's scripts across a deploy, or a stream
 * the server could not finish, after which React re-renders on the client
 * with modules that no longer match. Both are cured by loading the page
 * again, which is exactly what people did by hand, several times.
 *
 * So the first time an error lands here the page reloads itself once,
 * remembered in sessionStorage so a genuinely broken page cannot loop; the
 * second time it shows the screen, in the shape of the workspace's own
 * "Halaman ini gagal dimuat", with the digest for the server logs.
 *
 * This file replaces the root layout when it renders, so it carries its own
 * html and body and imports the stylesheet itself; the font variables are
 * not set here, so the type falls back to the system stack.
 */
const RELOAD_KEY = "sa-global-error-reload"
const RELOAD_WINDOW_MS = 60_000

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [reloading, setReloading] = useState(true)

  useEffect(() => {
    console.error("Sales Activity fatal error:", error)
    let reloadedRecently = false
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? "0")
      reloadedRecently = Date.now() - last < RELOAD_WINDOW_MS
      if (!reloadedRecently) sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    } catch {
      // Storage blocked: treat as already reloaded and show the screen.
      reloadedRecently = true
    }
    if (!reloadedRecently) {
      window.location.reload()
      return
    }
    setReloading(false)
  }, [error])

  return (
    <html lang="id" className="bg-background" style={{ backgroundColor: "#F6F8FB", colorScheme: "light" }}>
      <body className="bg-background antialiased" style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
        <div className="grid min-h-screen place-items-center bg-background px-4 py-12">
          {reloading ? (
            <p role="status" className="text-sm text-muted-foreground">Memuat ulang…</p>
          ) : (
            <div className="w-full max-w-md rounded-xl border bg-card px-6 py-8 text-center">
              <span aria-hidden="true" className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--danger)] text-[var(--danger-foreground)] text-xl font-semibold">!</span>
              <h1 className="mt-4 text-lg font-semibold text-foreground">Halaman ini gagal dimuat</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Sudah dicoba dimuat ulang sekali dan masih gagal. Biasanya ini karena aplikasi baru saja diperbarui atau koneksi terputus. Coba muat ulang sekali lagi; kalau masih gagal, tutup tab ini lalu buka aplikasinya lagi.
              </p>
              {error.digest && <p className="mt-3 font-mono text-[11px] text-muted-foreground">Kode: {error.digest}</p>}
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Muat ulang
                </button>
                <a
                  href="/workspace"
                  onClick={() => reset()}
                  className="inline-flex h-11 items-center justify-center rounded-md border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Kembali ke dashboard
                </a>
              </div>
            </div>
          )}
        </div>
      </body>
    </html>
  )
}
