"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/utils/supabase/client"
import { ArrowLeft, CheckCircle2, Loader2, MailCheck } from "lucide-react"

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
    <main className="grid min-h-screen place-items-center bg-[#f7f8fa] px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#02378D] text-lg font-bold text-white">W</div>
          <div><p className="font-semibold">Werkudara Group</p><p className="text-sm text-[var(--muted)]">Sales Mission</p></div>
        </div>

        <div className="rounded-2xl border border-[#e2e6eb] bg-white p-7 shadow-sm">
          {sent ? (
            <div role="status">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-green-50 text-green-600"><MailCheck size={20} /></span>
              <h1 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-[#17202a]">Cek email Anda</h1>
              <p className="mt-3 leading-7 text-[var(--muted)]">
                Kalau <strong className="text-[#17202a]">{email}</strong> terdaftar, kami sudah mengirim tautan untuk mengatur ulang password. Tautan berlaku terbatas.
              </p>
              <Link className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#02378D] hover:underline" href="/login">
                <ArrowLeft size={15} /> Kembali ke login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#17202a]">Lupa password</h1>
              <p className="mt-3 leading-7 text-[var(--muted)]">Masukkan email Anda. Kami kirim tautan untuk membuat password baru.</p>

              {error ? (
                <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700" role="alert">{error}</div>
              ) : null}

              <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
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

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center rounded-lg bg-[#02378D] px-4 font-semibold text-white shadow-lg shadow-[#02378D]/20 transition hover:bg-[#012d73] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mengirim…</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Kirim tautan reset</>}
                </button>
              </form>

              <Link className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#02378D] hover:underline" href="/login">
                <ArrowLeft size={15} /> Kembali ke login
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
