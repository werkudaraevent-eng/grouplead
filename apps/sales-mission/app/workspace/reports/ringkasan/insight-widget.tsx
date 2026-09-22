"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { AlertCircle, Info, Loader2, RefreshCw, TrendingDown, TrendingUp } from "@/components/icons"
import { ensureTodayInsight, regenerateTodayInsight } from "@/app/actions/ai-insight-actions"
import { TEASER_ITEMS, teaserInsightItems } from "@/lib/ai/insight-brief"
import type { InsightView } from "@/lib/ai/insight-view"
import { Button } from "@/components/ui/button"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { paths } from "@/lib/paths"
import { cn } from "@/lib/utils"

/**
 * The day's AI brief, as the card on the board: the door, not the content.
 *
 * The brief itself is three sections on its own tab; a card in a grid can
 * only honestly hold a teaser, so it shows at most three points — what has
 * to be acted on first, then what management is asked to decide, then the
 * field — and one text button into the page (Google Analytics' "View all
 * insights"). No scroller inside: a card that scrolls hides how much it
 * holds and fights the board's own scrolling, so a point that does not fit
 * clamps and the page is where it is read whole.
 *
 * The shell (title, "Dibuat AI" chip, drag handle, size menu) is the same
 * as every other widget's, so the board's owner arranges, shrinks or hides
 * it like any card. A sentence from a model is an estimate with a
 * timestamp, not a figure, so the foot says when it was written and from
 * what, and that it can be wrong. If nothing exists yet the card asks for
 * one after the page has painted and shows what it is doing, so the board
 * never waits on the model. Failure is a sentence and, for admins, a Buat
 * ulang.
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

  const teaser = useMemo(() => teaserInsightItems(view?.items ?? [], TEASER_ITEMS), [view])

  return (
    <div className="flex h-full flex-col" aria-busy={loading || regenerating}>
      {/* The 8px the hover backgrounds bleed into is carried here, so nothing inside is wider than the card (a negative margin on a line would grow a horizontal scrollbar). */}
      <div className="-mx-2 min-h-0 flex-1 overflow-hidden px-2">
        {loading || regenerating ? (
          <p className="flex items-center gap-2 py-1 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Menyusun brief dari data hari ini…
          </p>
        ) : view?.status === "ready" ? (
          <ol className="space-y-1">
            {teaser.map((item, index) => (
              <li key={index}>
                <InsightLine item={item} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-1 text-sm text-muted-foreground">{view?.error ?? "Insight belum tersedia."}</p>
        )}
      </div>

      {/* M3 card foot: supporting text at the start, the actions at the end. The model's id stays in the audit table, not on the card. */}
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
        <span className="flex shrink-0 items-center">
          <Button asChild type="button" variant="ghost" size="sm" className="h-9 shrink-0 md:h-8">
            <Link href={paths.reportInsight()}>Baca brief lengkap</Link>
          </Button>
          {canRegenerate && (
            <Button type="button" variant="ghost" size="sm" className="-mr-2 h-9 shrink-0 md:h-8" onClick={regenerate} disabled={loading || regenerating}>
              {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Buat ulang
            </Button>
          )}
        </span>
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
      {/* Three lines is where a teaser stops; the rest of the sentence is on the brief. */}
      <span className="line-clamp-3 text-sm leading-relaxed text-foreground">{item.text}</span>
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
