"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { AlertCircle, Info, Loader2, RefreshCw, TrendingDown, TrendingUp } from "@/components/icons"
import { ensureTodayInsight, regenerateTodayInsight } from "@/app/actions/ai-insight-actions"
import type { InsightView } from "@/lib/ai/insight-view"
import { Button } from "@/components/ui/button"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { cn } from "@/lib/utils"

/**
 * The day's AI-written insight: the body of one card in the grid, whose
 * shell (title, "Dibuat AI" chip, drag handle, size menu) is the same as
 * every other widget's, so the board's owner arranges, shrinks or hides
 * it like any card (Google Analytics Insights). A sentence from a model
 * is an estimate with a timestamp, not a figure, so the foot says when it
 * was written and from what, and that it can be wrong. Each point is a
 * list item with a kind icon; a point that a list can answer is a link
 * into that list, the same drill-down the widgets use. If nothing exists
 * yet the card asks for one after the page has painted and shows what it
 * is doing, so the board never waits on the model. Failure is a sentence
 * and, for admins, a Buat ulang.
 */
export function InsightWidget({ initial, canRegenerate, scopeNote }: { initial: InsightView | null; canRegenerate: boolean; scopeNote: string | null }) {
  const [view, setView] = useState<InsightView | null>(initial)
  const [loading, setLoading] = useState(!initial || initial.status === "pending")
  const [regenerating, startRegenerate] = useTransition()

  useEffect(() => {
    if (initial && initial.status !== "pending") {
      setView(initial)
      setLoading(false)
      return
    }
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
    <div className="flex h-full flex-col" aria-busy={loading || regenerating}>
      {/* The scroller carries the 8px the hover backgrounds bleed into, so nothing inside is wider than it (a negative margin on a line would grow a horizontal scrollbar). */}
      <div className="thin-scrollbar -mx-2 min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2">
        {loading || regenerating ? (
          <p className="flex items-center gap-2 py-1 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Menyusun insight dari data hari ini…
          </p>
        ) : view?.status === "ready" ? (
          <ol className="space-y-1">
            {view.items.map((item, index) => (
              <li key={index}>
                <InsightLine item={item} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-1 text-sm text-muted-foreground">{view?.error ?? "Insight belum tersedia."}</p>
        )}
      </div>

      {/* M3 card foot: supporting text at the start, the one action at the end. The model's id stays in the audit table, not on the card. */}
      <footer className="mt-2 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1">
          {view?.generatedAt ? (
            <>
              {describeWhen(view.generatedAt)}
              {view.status === "ready" ? (view.reportsSeen > 0 ? ` · dari ${view.reportsSeen} laporan hari ini` : " · belum ada laporan hari ini") : ""}
            </>
          ) : (
            "Belum pernah dibuat hari ini."
          )}
          {scopeNote ? ` · ${scopeNote}` : ""}
          {" · AI bisa keliru; angkanya berasal dari data aplikasi."}
        </span>
        {canRegenerate && (
          <Button type="button" variant="ghost" size="sm" className="-mr-2 h-9 shrink-0 md:h-8" onClick={regenerate} disabled={loading || regenerating}>
            {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Buat ulang
          </Button>
        )}
      </footer>
    </div>
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
    <Link href={item.href} className="flex items-start gap-2.5 rounded-md px-2 py-1 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none" title="Buka daftarnya">
      {body}
    </Link>
  ) : (
    <div className="flex items-start gap-2.5 px-2 py-1">{body}</div>
  )
}

function describeWhen(iso: string): string {
  return `Dibuat ${new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))} WIB`
}
