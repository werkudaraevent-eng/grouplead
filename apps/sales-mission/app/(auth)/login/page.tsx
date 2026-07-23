"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { AZURE_SCOPES } from "@/lib/auth"
import { Loader2 } from "lucide-react"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const readError = (code: string | null, description: string | null) => {
    if (code === "access_not_provisioned") return "Login Microsoft berhasil, tetapi akun belum mendapat akses Sales Mission. Minta admin menambahkan company membership dan permission Sales Mission."
    if (code === "auth_callback_failed") return description || "Login Microsoft gagal saat callback. Coba lagi."
    if (code === "auth_callback_missing_code") return description || "Microsoft tidak mengirim authorization code. Coba login ulang."
    return description || (code ? `Login gagal (${code}). Coba lagi.` : null)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errorCode = params.get("error")
    const errorDescription = params.get("error_description")

    setError(readError(errorCode, errorDescription))
  }, [])

  async function signInWithMicrosoft() {
    setLoading(true)
    setError(null)

    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          scopes: AZURE_SCOPES,
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Microsoft login tidak dapat dimulai. Coba lagi.")
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] lg:grid lg:grid-cols-[55%_45%]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#02378D] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-[#02378D] via-[#0247b3] to-[#013a91]" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#F9BB46]/10 blur-3xl" />
        <div className="relative z-10 flex items-center gap-3 text-white"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-lg font-bold ring-1 ring-white/20">W</div><span className="font-semibold">Werkudara Group</span></div>
        <div className="relative z-10 max-w-lg text-white"><p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#F9BB46]">Sales Mission</p><h1 className="text-5xl font-bold leading-[1.04] tracking-[-0.04em]">Coordinate visits.<br />Capture momentum.<br /><span className="text-[#F9BB46]">Move together.</span></h1><p className="mt-6 max-w-md text-base leading-7 text-white/65">A focused workspace for planning client missions and turning every visit into a clear next action.</p></div>
        <p className="relative z-10 text-xs text-white/45">© {new Date().getFullYear()} Werkudara Group</p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#02378D] text-lg font-bold text-white">W</div><div><p className="font-semibold">Werkudara Group</p><p className="text-sm text-[var(--muted)]">Sales Mission</p></div></div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#02378D]">Sales Mission</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-[#17202a]">Welcome back</h1>
          <p className="mt-3 leading-7 text-[var(--muted)]">Use your Werkudara Microsoft account to continue.</p>
          {error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700" role="alert"><p className="font-semibold">Login tidak berhasil</p><p className="mt-1">{error}</p><button className="mt-2 font-semibold underline" type="button" onClick={() => setError(null)}>Tutup</button></div> : null}
          <button className="mt-8 flex h-12 w-full items-center justify-center rounded-lg bg-[#02378D] px-4 font-semibold text-white shadow-lg shadow-[#02378D]/20 transition-[background-color,transform] duration-150 ease-out hover:bg-[#012d73] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60" disabled={loading} onClick={signInWithMicrosoft} type="button">{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening Microsoft…</> : "Continue with Microsoft"}</button>
          <p className="mt-8 border-t border-[#e2e6eb] pt-5 text-center text-xs leading-5 text-[var(--muted)]">Access is managed by Werkudara Group administrators.</p>
        </div>
      </section>
    </main>
  )
}
