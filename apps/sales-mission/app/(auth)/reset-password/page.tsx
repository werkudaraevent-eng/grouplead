"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/client"
import { clearActiveSessionId } from "@/lib/session-guard"
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react"

const INVALID_LINK = "Tautan reset ini tidak valid atau sudah kedaluwarsa. Minta tautan baru."

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [verifying, setVerifying] = useState(true)
  const [validSession, setValidSession] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  // Establish the recovery session from the email link. Both link formats are
  // supported, matching LeadEngine:
  //   1. token_hash + type=recovery → verifyOtp(). Not browser-bound, so the
  //      link still works when opened on another device. Preferred.
  //   2. PKCE ?code= → exchangeCodeForSession(). Browser-bound fallback for the
  //      default Supabase email template.
  useEffect(() => {
    let active = true

    const establish = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get("code")
      const tokenHash = params.get("token_hash")
      const type = params.get("type")
      const errorDescription = params.get("error_description")

      if (errorDescription) {
        if (active) { setError(errorDescription); setVerifying(false) }
        return
      }

      if (tokenHash) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          type: (type as "recovery") || "recovery",
          token_hash: tokenHash,
        })
        if (!active) return
        if (otpError) { setError(INVALID_LINK); setVerifying(false); return }
        window.history.replaceState({}, "", "/reset-password")
        setValidSession(true)
        setVerifying(false)
        return
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (!active) return
        if (exchangeError) { setError(INVALID_LINK); setVerifying(false); return }
        window.history.replaceState({}, "", "/reset-password")
        setValidSession(true)
        setVerifying(false)
        return
      }

      // No token in the URL — a recovery session may already exist.
      const { data } = await supabase.auth.getSession()
      if (!active) return
      if (data.session) setValidSession(true)
      else setError(INVALID_LINK)
      setVerifying(false)
    }

    establish()
    return () => { active = false }
  }, [supabase])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < 8) { setError("Password minimal 8 karakter."); return }
    if (password !== confirm) { setError("Konfirmasi password tidak sama."); return }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setDone(true)
    setSaving(false)
    // Drop the recovery session so the user signs in fresh. Clearing the shared
    // session id too, otherwise a stale id would linger for the sibling app.
    clearActiveSessionId()
    await supabase.auth.signOut()
    setTimeout(() => router.push("/login"), 2500)
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8fa] px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#02378D] text-lg font-bold text-white">W</div>
          <div><p className="font-semibold">Werkudara Group</p><p className="text-sm text-[var(--muted)]">Sales Mission</p></div>
        </div>

        <div className="rounded-2xl border border-[#e2e6eb] bg-white p-7 shadow-sm">
          {verifying ? (
            <div className="flex items-center gap-3 text-[var(--muted)]" role="status">
              <Loader2 className="h-4 w-4 animate-spin" /> Memeriksa tautan…
            </div>
          ) : done ? (
            <div role="status">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-green-50 text-green-600"><CheckCircle2 size={20} /></span>
              <h1 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-[#17202a]">Password diperbarui</h1>
              <p className="mt-3 leading-7 text-[var(--muted)]">Mengarahkan ke halaman login…</p>
            </div>
          ) : validSession ? (
            <>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#02378D]/10 text-[#02378D]"><KeyRound size={20} /></span>
              <h1 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-[#17202a]">Buat password baru</h1>
              <p className="mt-3 leading-7 text-[var(--muted)]">Minimal 8 karakter. Password ini berlaku untuk LeadEngine dan Sales Mission.</p>

              {error ? (
                <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700" role="alert">{error}</div>
              ) : null}

              <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#17202a]" htmlFor="password">Password baru</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      autoComplete="new-password"
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

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#17202a]" htmlFor="confirm">Ulangi password</label>
                  <input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="h-11 w-full rounded-lg border border-[#e2e6eb] bg-[#f7f8fa] px-3.5 text-[15px] outline-none transition focus:border-[#02378D] focus:bg-white focus:ring-2 focus:ring-[#02378D]/15"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex h-12 w-full items-center justify-center rounded-lg bg-[#02378D] px-4 font-semibold text-white shadow-lg shadow-[#02378D]/20 transition hover:bg-[#012d73] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan…</> : "Simpan password"}
                </button>
              </form>
            </>
          ) : (
            <div role="alert">
              <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#17202a]">Tautan tidak berlaku</h1>
              <p className="mt-3 leading-7 text-[var(--muted)]">{error ?? INVALID_LINK}</p>
              <Link className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#02378D] hover:underline" href="/forgot-password">
                <ArrowLeft size={15} /> Minta tautan baru
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
