"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CalendarCheck, ClipboardList, Eye, EyeOff, Loader2, MapPinned, Users } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { clearActiveSessionId, newSessionId, writeActiveSessionId } from "@/lib/session-guard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
    <div className="flex h-screen overflow-clip">
      {/* Left Panel — Branding & Visual */}
      <div className="relative hidden overflow-hidden bg-primary lg:flex lg:w-[55%]">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-[#0247b3] to-[#013a91]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="absolute left-20 top-20 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-32 right-16 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative z-10 flex h-full w-full flex-col justify-between p-8 xl:p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm">
              <span className="text-base font-bold text-white">W</span>
            </div>
            <span className="text-base font-semibold tracking-tight text-white/90">Werkudara Group</span>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
                Atur kunjungan.<br />
                Rekam hasilnya.<br />
                <span className="text-accent">Bergerak bersama.</span>
              </h1>
              <p className="max-w-sm text-base leading-relaxed text-white/60">
                Ruang kerja untuk merencanakan kunjungan klien dan mengubah setiap pertemuan jadi langkah lanjutan yang jelas.
              </p>
            </div>

            <div className="grid max-w-sm grid-cols-2 gap-2.5">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.07] px-3 py-2.5 backdrop-blur-sm">
                <ClipboardList className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs font-medium text-white/80">Rencana kunjungan</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.07] px-3 py-2.5 backdrop-blur-sm">
                <Users className="h-3.5 w-3.5 text-secondary" />
                <span className="text-xs font-medium text-white/80">Penugasan tim</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.07] px-3 py-2.5 backdrop-blur-sm">
                <CalendarCheck className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs font-medium text-white/80">Jadwal lapangan</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.07] px-3 py-2.5 backdrop-blur-sm">
                <MapPinned className="h-3.5 w-3.5 text-secondary" />
                <span className="text-xs font-medium text-white/80">Hasil kunjungan</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-white/45">© {new Date().getFullYear()} Werkudara Group</p>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 sm:px-12 lg:px-16">
        <div className="w-full max-w-[380px] space-y-8">
          <div className="mb-4 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <span className="text-base font-bold text-primary-foreground">W</span>
            </div>
            <span className="text-base font-semibold tracking-tight text-foreground">Werkudara Group</span>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Sales Mission</p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Selamat datang</h2>
            <p className="text-[15px] text-muted-foreground">Masuk dengan akun Werkudara Anda.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-[var(--danger-foreground)]/20 bg-[var(--danger)] px-4 py-3 text-sm text-[var(--danger-foreground)]" role="alert">
                <p>{error}</p>
                {signedInButRejected && (
                  <button className="mt-2 font-semibold underline" type="button" onClick={handleSignOut}>
                    Keluar dan masuk dengan akun lain
                  </button>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Alamat email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@werkudara.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="h-11 border-border/60 bg-muted/40 transition-colors focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Kata sandi</Label>
                <Link href="/forgot-password" className="text-xs font-medium text-primary transition-colors hover:text-primary/80">
                  Lupa kata sandi?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 border-border/60 bg-muted/40 pr-11 transition-colors focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full text-[15px] font-medium shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Memproses…" : "Masuk"}
            </Button>
          </form>

          <div className="border-t border-border/40 pt-4">
            <p className="text-center text-xs text-muted-foreground">
              Akses diatur oleh administrator Werkudara Group.
              <br />
              <span className="text-muted-foreground/70">© {new Date().getFullYear()} Werkudara Group. All rights reserved.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
