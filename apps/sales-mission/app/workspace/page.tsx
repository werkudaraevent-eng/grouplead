import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { resolveProviderDisplayName } from "@/lib/auth"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { redirect } from "next/navigation"
import { AppSwitcher } from "@/app/workspace/app-switcher"

export const dynamic = "force-dynamic"

export default async function MissionHomePage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const displayName = resolveProviderDisplayName(user?.user_metadata ?? {})

  return (
    <main className="min-h-screen px-6 py-10 sm:px-10 lg:px-16">
      <section className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-[var(--border)] pb-6">
          <div className="flex items-center gap-3">
            <AppSwitcher />
            <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Sales Mission</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Mission workspace</h1>
            </div>
          </div>
          <span className="text-sm text-[var(--muted)]">{displayName}</span>
        </header>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ["Plan mission", "Schedule confirmed client visits."],
            ["Assignments", "Coordinate primary and supporting sales."],
            ["Results", "Capture outcomes and next actions."],
          ].map(([title, description]) => (
            <article className="rounded-xl border border-[var(--border)] bg-white p-6" key={title}>
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 flex items-center gap-4">
          <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">Foundation phase</span>
          <Link className="text-sm font-semibold text-[var(--brand)] hover:underline" href="/">Back to overview</Link>
        </div>
      </section>
    </main>
  )
}
