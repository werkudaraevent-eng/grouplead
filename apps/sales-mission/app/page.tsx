import Link from "next/link"

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-16 sm:px-10 lg:px-16">
      <section className="mx-auto max-w-6xl">
        <div className="mb-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand)] text-lg font-bold text-white">W</div>
            <span className="font-semibold tracking-tight">Werkudara Group</span>
          </div>
          <Link className="text-sm font-semibold text-[var(--brand)] hover:underline" href="/login">Sign in</Link>
        </div>

        <div className="grid gap-12 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
          <div>
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Sales Mission</p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-7xl">
              Turn confirmed visits into clear next actions.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted)]">
              Plan client missions, coordinate sales assignments, and capture visit results in one focused workspace.
            </p>
            <Link className="mt-9 inline-flex rounded-lg bg-[var(--brand)] px-5 py-3 font-semibold text-white transition hover:bg-[#012d73]" href="/login">
              Continue with Microsoft
            </Link>
          </div>

          <div className="border-l-2 border-[var(--accent)] pl-6 lg:mb-2">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Foundation preview</p>
            <dl className="mt-6 grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
              <div><dt className="text-3xl font-semibold">01</dt><dd className="mt-1 text-sm text-[var(--muted)]">Schedule confirmed visits</dd></div>
              <div><dt className="text-3xl font-semibold">02</dt><dd className="mt-1 text-sm text-[var(--muted)]">Assign primary and support sales</dd></div>
              <div><dt className="text-3xl font-semibold">03</dt><dd className="mt-1 text-sm text-[var(--muted)]">Capture structured outcomes</dd></div>
            </dl>
          </div>
        </div>
      </section>
    </main>
  )
}
