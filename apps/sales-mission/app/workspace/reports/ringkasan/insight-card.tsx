"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { AlertCircle, Info, Loader2, RefreshCw, Sparkles, TrendingDown, TrendingUp } from "@/components/icons"
import { ensureTodayInsight, regenerateTodayInsight } from "@/app/actions/ai-insight-actions"
import type { InsightView } from "@/lib/ai/insight-view"
import { Button } from "@/components/ui/button"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { cn } from "@/lib/utils"

/**
 * The day's AI-written insight, above the widgets.
 *
 * A card that says what it is: a leading spark icon, the label "Dibuat AI"
 * as a tonal chip, and the time it was written, because a sentence from a
 * model is an estimate with a timestamp, not a figure (HubSpot's and
 * Salesforce's generative summaries carry the same mark). Each point is a
 * list item with a kind icon; a point that a list can answer is a link into
 * that list, the same drill-down the widgets use. If nothing exists yet the
 * card asks for one after the page has painted and shows what it is doing,
 * so the board never waits on the model. Failure is a sentence and, for
 * admins, a Buat ulang.
 */
export function InsightCard({ initial, canRegenerate, scopeNote }: { initial: InsightView | null; canRegenerate: boolean; scopeNote: string | null }) {
  const [view, setView] = useState<InsightView | null>(initial)
  const [loading, setLoading] = useState(!initial || initial.status === "pending")
  const [regenerating, startRegenerate] = useTransition()

  useEffect(() => {
    if (initial && initial.status !== "pending") return
    let cancelled = false
    ensureTodayInsight().then((result) => {
      if (cancelled) return
      if (result.success && result.data) setView(result.data)
      else setView({ status: "failed", items: [], generatedAt: null, model: null, error: result.error ?? "Insight gagal dibuat.", trigger: "view", reportsSeen: 0, scope: "unit", day: "" })
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [initial])

  const regenerate = () => {
    startRegenerate(async () => {
      const result = await regenerateTodayInsight()
      if (result.success && result.data) {
        setView(result.data)
        toast.success("Insight dibuat ulang.")
      } else {
        toast.error(result.error ?? "Insight gagal dibuat ulang.")
      }
    })
  }

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="insight-title" aria-busy={loading || regenerating}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pt-4">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--tonal)] text-[var(--tonal-foreground)]" aria-hidden="true">
          <Sparkles className="h-4 w-4" />
        </span>
        <h2 id="insight-title" className="text-base font-semibold text-foreground">Insight hari ini</h2>
        <span className="rounded-md bg-[var(--tonal)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--tonal-foreground)]">Dibuat AI</span>
        {canRegenerate && (
          <Button type="button" variant="ghost" size="sm" className="ml-auto -mr-2 h-9 md:h-9" onClick={regenerate} disabled={loading || regenerating}>
            {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Buat ulang
          </Button>
        )}
      </header>

      <div className="px-5 pb-4 pt-3">
        {loading || regenerating ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Menyusun insight dari data hari ini…
          </p>
        ) : view?.status === "ready" ? (
          <ol className="space-y-2">
            {view.items.map((item, index) => (
              <li key={index}>
                <InsightLine item={item} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            {view?.error ?? "Insight belum tersedia."}
          </p>
        )}
      </div>

      <footer className="border-t px-5 py-2 text-xs text-muted-foreground">
        {view?.generatedAt ? (
          <>
            {describeWhen(view.generatedAt)}
            {view.status === "ready" ? ` · dari ${view.reportsSeen} laporan hari ini` : ""}
            {view.model ? ` · ${view.model}` : ""}
          </>
        ) : (
          "Belum pernah dibuat hari ini."
        )}
        {scopeNote ? ` · ${scopeNote}` : ""}
        {" · AI bisa keliru; angkanya berasal dari data aplikasi."}
      </footer>
    </section>
  )
}

const KIND_STYLE: Record<InsightView["items"][number]["kind"], { icon: typeof Info; className: string; label: string }> = {
  naik: { icon: TrendingUp, className: "text-[var(--success-foreground)]", label: "Naik" },
  turun: { icon: TrendingDown, className: "text-[var(--danger-foreground)]", label: "Turun" },
  perlu_tindakan: { icon: AlertCircle, className: "text-[var(--warning-foreground)]", label: "Perlu tindakan" },
  info: { icon: Info, className: "text-muted-foreground", label: "Info" },
}

function InsightLine({ item }: { item: InsightView["items"][number] }) {
  const style = KIND_STYLE[item.kind] ?? KIND_STYLE.info
  const Icon = style.icon
  const body = (
    <>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.className)} aria-label={style.label} />
      <span className="text-sm leading-relaxed text-foreground">{item.text}</span>
    </>
  )
  return item.href ? (
    <Link href={item.href} className="-mx-2 flex items-start gap-2.5 rounded-md px-2 py-1 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none" title="Buka daftarnya">
      {body}
    </Link>
  ) : (
    <div className="flex items-start gap-2.5 px-0 py-1">{body}</div>
  )
}

function describeWhen(iso: string): string {
  return `Dibuat ${new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))} WIB`
}
