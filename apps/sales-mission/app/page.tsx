import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background px-6 py-16 sm:px-10 lg:px-16">
      <section className="mx-auto max-w-6xl">
        <div className="mb-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">W</div>
            <span className="font-semibold tracking-tight text-foreground">Werkudara Group</span>
          </div>
          <Link className="text-sm font-semibold text-primary hover:underline" href="/login">Sign in</Link>
        </div>

        <div className="grid gap-12 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
          <div>
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.18em] text-primary">Sales Mission</p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-[-0.04em] text-foreground sm:text-7xl">
              Turn confirmed visits into clear next actions.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
              Plan client missions, coordinate sales assignments, and capture visit results in one focused workspace.
            </p>
            <Button asChild size="lg" className="mt-9 h-12 px-6 text-[15px]">
              <Link href="/login">
                Sign in <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="border-l-2 border-accent pl-6 lg:mb-2">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">Foundation preview</p>
            <dl className="mt-6 grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
              <div><dt className="text-3xl font-semibold text-foreground">01</dt><dd className="mt-1 text-sm text-muted-foreground">Schedule confirmed visits</dd></div>
              <div><dt className="text-3xl font-semibold text-foreground">02</dt><dd className="mt-1 text-sm text-muted-foreground">Assign primary and support sales</dd></div>
              <div><dt className="text-3xl font-semibold text-foreground">03</dt><dd className="mt-1 text-sm text-muted-foreground">Capture structured outcomes</dd></div>
            </dl>
          </div>
        </div>
      </section>
    </main>
  )
}
