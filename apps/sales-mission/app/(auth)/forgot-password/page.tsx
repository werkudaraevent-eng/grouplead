"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, MailCheck } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
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
          {sent ? (
            <div className="space-y-5 text-center" role="status">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success)]">
                <MailCheck className="h-6 w-6 text-[var(--success-foreground)]" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Cek email Anda</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Kalau <strong className="text-foreground">{email}</strong> terdaftar, kami sudah mengirim tautan untuk
                  mengatur ulang password. Tautan berlaku terbatas.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke login
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Lupa kata sandi</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Masukkan email Anda. Kami kirim tautan untuk membuat password baru.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="rounded-lg border border-[var(--danger-foreground)]/20 bg-[var(--danger)] px-4 py-3 text-sm text-[var(--danger-foreground)]" role="alert">
                    {error}
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

                <Button type="submit" disabled={loading} className="h-11 w-full text-[15px] font-medium">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? "Mengirim…" : "Kirim tautan reset"}
                </Button>
              </form>

              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
