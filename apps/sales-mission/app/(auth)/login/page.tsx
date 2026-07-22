"use client"

import { useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { AZURE_SCOPES } from "@/lib/auth"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function signInWithMicrosoft() {
    setLoading(true)
    setError(null)

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
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-8 shadow-sm">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand)] text-lg font-bold text-white">W</div>
          <div>
            <p className="font-semibold">Werkudara Group</p>
            <p className="text-sm text-[var(--muted)]">Sales Mission</p>
          </div>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-3 leading-7 text-[var(--muted)]">Use your Werkudara Microsoft account to continue.</p>
        <button
          className="mt-8 flex w-full items-center justify-center rounded-lg bg-[var(--brand)] px-4 py-3 font-semibold text-white transition hover:bg-[#012d73] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
          onClick={signInWithMicrosoft}
          type="button"
        >
          {loading ? "Redirecting…" : "Continue with Microsoft"}
        </button>
        {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p> : null}
      </section>
    </main>
  )
}
