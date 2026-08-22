"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/client"
import { clearActiveSessionId, newSessionId, writeActiveSessionId } from "@/lib/session-guard"
import { Eye, EyeOff, Loader2 } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A rejected user arrives here still holding a valid shared session, so the
  // form alone would be a dead end. Offer a way out of that session.
  const [signedInButRejected, setSignedInButRejected] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const errorCode = new URLSearchParams(window.location.search).get("error")
    if (errorCode === "access_not_provisioned") {
      setError("Akun Anda belum mendapat akses Sales Mission. Minta admin menambahkan company membership dan permission Sales Mission.")
      setSignedInButRejected(true)
    }
  }, [])

  async function handleSignOut() {
    clearActiveSessionId()
    await supabase.auth.signOut()
    setSignedInButRejected(false)
    setError(null)
    router.refresh()
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Single active session, shared with LeadEngine. Write the cookie before the
    // profile update so a LeadEngine tab reacting to the change reads this id
    // and does not mistake it for a sign-in somewhere else.
    if (data.user) {
      const sessionId = newSessionId()
      writeActiveSessionId(sessionId)
      try {
        await supabase.from("profiles").update({ active_session_id: sessionId }).eq("id", data.user.id)
      } catch {
        // Non-fatal — login still proceeds even if the stamp fails.
      }
    }

    router.push("/workspace")
    router.refresh()
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
          <p className="mt-3 leading-7 text-[var(--muted)]">Masuk dengan akun Werkudara Anda.</p>

          {error ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700" role="alert">
              <p className="font-semibold">Login tidak berhasil</p>
              <p className="mt-1">{error}</p>
              {signedInButRejected ? (
                <button className="mt-2 font-semibold underline" type="button" onClick={handleSignOut}>
                  Keluar dan masuk dengan akun lain
                </button>
              ) : null}
            </div>
          ) : null}

          <form className="mt-8 space-y-5" onSubmit={handleLogin}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#17202a]" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="nama@werkudara.com"
                className="h-11 w-full rounded-lg border border-[#e2e6eb] bg-[#f7f8fa] px-3.5 text-[15px] outline-none transition focus:border-[#02378D] focus:bg-white focus:ring-2 focus:ring-[#02378D]/15"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[#17202a]" htmlFor="password">Password</label>
                <Link className="text-xs font-semibold text-[#02378D] hover:underline" href="/forgot-password">Lupa password?</Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-11 w-full rounded-lg border border-[#e2e6eb] bg-[#f7f8fa] px-3.5 pr-11 text-[15px] outline-none transition focus:border-[#02378D] focus:bg-white focus:ring-2 focus:ring-[#02378D]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-[var(--muted)] transition hover:bg-[#eef1f4] hover:text-[#17202a]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center rounded-lg bg-[#02378D] px-4 font-semibold text-white shadow-lg shadow-[#02378D]/20 transition-[background-color,transform] duration-150 ease-out hover:bg-[#012d73] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</> : "Sign in"}
            </button>
          </form>

          <p className="mt-8 border-t border-[#e2e6eb] pt-5 text-center text-xs leading-5 text-[var(--muted)]">Access is managed by Werkudara Group administrators.</p>
        </div>
      </section>
    </main>
  )
}
