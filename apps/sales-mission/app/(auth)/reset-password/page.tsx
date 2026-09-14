"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "@/components/icons"
import { createClient } from "@/utils/supabase/client"
import { clearActiveSessionId } from "@/lib/session-guard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6 py-12">
      <div className="w-full max-w-[400px] space-y-8">
        <div className="flex items-center justify-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <span className="text-base font-bold text-primary-foreground">W</span>
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">Werkudara Group</span>
        </div>

        <div className="space-y-6 rounded-2xl border border-border/60 bg-white p-8 shadow-sm">
          {verifying ? (
            <div className="flex flex-col items-center gap-3 py-6" role="status">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">Memeriksa tautan reset…</p>
            </div>
          ) : done ? (
            <div className="space-y-5 text-center" role="status">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success)]">
                <CheckCircle2 className="h-6 w-6 text-[var(--success-foreground)]" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Kata sandi diperbarui</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">Mengarahkan ke halaman login…</p>
              </div>
            </div>
          ) : !validSession ? (
            <div className="space-y-5 text-center" role="alert">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Tautan tidak berlaku</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{error ?? INVALID_LINK}</p>
              </div>
              <Link href="/forgot-password" className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80">
                Minta tautan baru
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <KeyRound className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Buat kata sandi baru</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Minimal 8 karakter. Password ini berlaku untuk LeadEngine dan Sales Mission.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="rounded-lg border border-[var(--danger-foreground)]/20 bg-[var(--danger)] px-4 py-3 text-sm text-[var(--danger-foreground)]" role="alert">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="password">Kata sandi baru</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="h-11 border-border/60 bg-muted/40 pr-11 transition-colors focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                      aria-pressed={showPassword}
                      tabIndex={-1}
                      className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Ulangi kata sandi</Label>
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="h-11 border-border/60 bg-muted/40 transition-colors focus:bg-white"
                  />
                </div>

                <Button type="submit" disabled={saving} className="h-11 w-full text-[15px] font-medium">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? "Menyimpan…" : "Simpan password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
