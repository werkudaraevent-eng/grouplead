"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CalendarCheck, CheckCircle2, ClipboardList, Eye, EyeOff, Info, Loader2, MapPinned, Users } from "@/components/icons"
import { createClient } from "@/utils/supabase/client"
import { SIGNED_OUT_MESSAGE, SIGNED_OUT_REASON } from "@/lib/devices/signed-out"
import { NEXT_PARAM, safeNextPath } from "@/lib/auth/next-path"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * How long the page waits after sending the person on to `next` before it
 * concludes the place was a download. A page unloads this one well before.
 */
const DOWNLOAD_HANDOFF_MS = 2500

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Signed out from another device (Perangkat aktif, an admin, a password
  // change): said once, as information rather than an error.
  const [notice, setNotice] = useState<string | null>(null)
  // A rejected user arrives here still holding a valid shared session, so the
  // form alone would be a dead end. Offer a way out of that session.
  const [signedInButRejected, setSignedInButRejected] = useState(false)
  // Signed in and sent on to `next`, but still here: the place was a download.
  const [handedOff, setHandedOff] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errorCode = params.get("error")
    if (errorCode === "access_not_provisioned") {
      setError("Akun Anda belum mendapat akses Sales Activity. Minta admin menambahkan company membership dan permission Sales Activity.")
      setSignedInButRejected(true)
    } else if (params.get("reason") === SIGNED_OUT_REASON) {
      setNotice(SIGNED_OUT_MESSAGE)
    }
  }, [])

  async function handleSignOut() {
    // This device only: a rejected sign-in must not end the person's other sessions.
    await supabase.auth.signOut({ scope: "local" })
    setSignedInButRejected(false)
    setError(null)
    router.refresh()
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Several sessions may be open at once, here and in LeadEngine; this one
    // joins them, and the workspace records the device on load (Perangkat aktif).
    //
    // Back to where the person was going when the proxy sent them here with
    // `?next=` (a file link from an exported workbook, a bookmark). A full
    // navigation rather than the router's: the place may be a file route
    // that answers with a redirect to storage, not a page the router can draw.
    // Replacing this entry, so Back from the photo does not land on /login,
    // which would bounce a signed-in person straight to the file again.
    //
    // A recording or an export answers with a download, and a download leaves
    // this page where it is, so the form would sit on "Memproses…" for good.
    // When the page is still here a moment later it says the person is in and
    // where the file went; a page destination unloads it before the timer.
    const next = safeNextPath(new URLSearchParams(window.location.search).get(NEXT_PARAM))
    if (next) {
      window.location.replace(next)
      window.setTimeout(() => {
        setLoading(false)
        setHandedOff(true)
      }, DOWNLOAD_HANDOFF_MS)
      return
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
      {/* On a phone the form starts near the top, so the fields stay in view
          when the keyboard rises and no third of the screen is empty above
          them; on a desk it sits at the panel's centre. */}
      <div className="flex flex-1 justify-center bg-background px-6 pb-8 pt-10 sm:px-12 lg:items-center lg:px-16 lg:py-0">
        <div className="w-full max-w-[380px] space-y-8">
          <div className="mb-4 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <span className="text-base font-bold text-primary-foreground">W</span>
            </div>
            <span className="text-base font-semibold tracking-tight text-foreground">Werkudara Group</span>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Sales Activity</p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Selamat datang</h2>
            <p className="text-sm text-muted-foreground">Masuk dengan akun Werkudara Anda.</p>
          </div>

          {handedOff ? (
            <div className="space-y-5" role="status">
              <div className="flex items-start gap-2 rounded-lg border bg-muted px-4 py-3 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p>Kamu sudah masuk. Kalau berkasnya terunduh, cek folder Unduhan di perangkatmu.</p>
              </div>
              <Button asChild className="h-12 w-full font-medium">
                <Link href="/workspace">Buka Sales Activity</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              {notice && !error && (
                <div className="flex items-start gap-2 rounded-lg border bg-muted px-4 py-3 text-sm text-foreground" role="status">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <p>{notice}</p>
                </div>
              )}
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
                  className="h-12 bg-field transition-colors focus:bg-card"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Kata sandi</Label>
                  <Link href="/forgot-password" className="inline-flex min-h-8 items-center text-sm font-medium text-primary transition-colors hover:text-primary/80">
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
                    className="h-12 bg-field pr-12 transition-colors focus:bg-card"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    aria-pressed={showPassword}
                    className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full font-medium"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Memproses…" : "Masuk"}
              </Button>
            </form>
          )}

          <div className="border-t border-border/40 pt-4">
            <p className="text-center text-xs text-muted-foreground">
              Akses diatur oleh administrator Werkudara Group.
              <br />
              <span>© {new Date().getFullYear()} Werkudara Group. Hak cipta dilindungi.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
