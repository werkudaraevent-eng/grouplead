"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { AlertCircle, FileText, Info, Loader2, RefreshCw, TrendingDown, TrendingUp, ListChecks } from "@/components/icons"
import { ensureTodayInsight, regenerateTodayInsight } from "@/app/actions/ai-insight-actions"
import { briefSections, briefShareText } from "@/lib/ai/insight-brief"
import type { InsightView, InsightViewItem } from "@/lib/ai/insight-view"
import { Button } from "@/components/ui/button"
import { WhatsAppShareButton } from "@/components/whatsapp-share-button"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { cn } from "@/lib/utils"

/**
 * The brief for one day: the content the card on Ringkasan is the door to.
 *
 * Three sections in a fixed order, each a short list, each point carrying
 * the same kind icon the card shows and, where the model named the reports
 * it read, a link to those reports so a claim can be checked in one tap
 * (Gong and Salesforce Einstein both hang their summaries off the calls
 * they were written from). The foot keeps the card's provenance sentence,
 * because a brief that travels is still a model's estimate with a
 * timestamp, and adds the two things only the page can do: rewrite today's
 * brief, and hand it to a WhatsApp group as plain text.
 *
 * Today with nothing stored asks for one after paint, the way the card
 * does, so a working day never opens on an empty page.
 */
export function BriefView({
  initial,
  day,
  isToday,
  canRegenerate,
  scopeNote,
}: {
  initial: InsightView | null
  day: string
  isToday: boolean
  canRegenerate: boolean
  scopeNote: string | null
}) {
  const [view, setView] = useState<InsightView | null>(initial)
  const [loading, setLoading] = useState(isToday && (!initial || initial.status === "pending"))
  const [regenerating, startRegenerate] = useTransition()

  useEffect(() => {
    setView(initial)
    if (!isToday || (initial && initial.status !== "pending")) {
      setLoading(false)
      return
    }
    setLoading(true)
    let cancelled = false
    ensureTodayInsight().then((result) => {
      if (cancelled) return
      if (result.success && result.data) setView(result.data)
      else
        setView({
          status: "failed",
          items: [],
          generatedAt: null,
          model: null,
          error: result.error ?? "Brief gagal dibuat.",
          trigger: "view",
          reportsSeen: 0,
          scope: "unit",
          day,
        })
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [initial, isToday, day])

  const regenerate = () => {
    startRegenerate(async () => {
      const result = await regenerateTodayInsight()
      if (result.success && result.data) {
        setView(result.data)
        toast.success("Brief dibuat ulang.")
      } else {
        toast.error(result.error ?? "Brief gagal dibuat ulang.")
      }
    })
  }

  const sections = useMemo(() => briefSections(view?.items ?? []), [view])
  const shareText = () => briefShareText({ day, items: view?.items ?? [], scopeNote })

  return (
    <section className="rounded-xl border bg-card" aria-busy={loading || regenerating} aria-live="polite">
      <div className="space-y-6 px-4 py-4 sm:px-6 sm:py-5">
        {loading || regenerating ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Menyusun brief dari laporan hari ini…
          </p>
        ) : view?.status === "ready" && sections.length > 0 ? (
          sections.map((group) => (
            <div key={group.section}>
              {/* M3 label-medium in sentence case, the same label the report card uses over its bands; capitals are the eyebrow's. */}
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{group.label}</h3>
              <ol className="space-y-2.5">
                {group.items.map((item, index) => (
                  <li key={index}>
                    <BriefLine item={item} />
                  </li>
                ))}
              </ol>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            {view?.error ?? (isToday ? "Brief belum tersedia." : "Belum ada brief untuk hari itu.")}
          </p>
        )}
      </div>

      {/* M3 card foot: provenance at the start, the actions at the end; on a phone the two stack, never squeeze. The model's id stays in the audit table. */}
      <footer className="flex flex-col gap-3 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:px-6">
        <span className="min-w-0 sm:flex-1">
          {view?.generatedAt ? (
            <>
              {describeWhen(view.generatedAt)}
              {view.status === "ready" ? (view.reportsSeen > 0 ? ` · dari ${view.reportsSeen} laporan hari ini` : " · belum ada laporan hari ini") : ""}
            </>
          ) : (
            "Belum pernah dibuat."
          )}
          {scopeNote ? ` · ${scopeNote}` : ""}
          {" · AI bisa keliru; angkanya berasal dari data aplikasi."}
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-2">
          <WhatsAppShareButton text={shareText} variant="outline" blockedHint="Browser menahan tab WhatsApp Web; teksnya sudah tersalin, tempel saja di chat." />
          {isToday && canRegenerate && (
            <Button type="button" variant="ghost" size="sm" onClick={regenerate} disabled={loading || regenerating}>
              {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Buat ulang
            </Button>
          )}
        </span>
      </footer>
    </section>
  )
}

const KIND_STYLE: Record<InsightViewItem["kind"], { icon: typeof Info; className: string; label: string }> = {
  naik: { icon: TrendingUp, className: "text-[var(--success-foreground)]", label: "Naik" },
  turun: { icon: TrendingDown, className: "text-[var(--danger-foreground)]", label: "Turun" },
  perlu_tindakan: { icon: AlertCircle, className: "text-[var(--warning-foreground)]", label: "Perlu tindakan" },
  info: { icon: Info, className: "text-muted-foreground", label: "Info" },
}

function BriefLine({ item }: { item: InsightViewItem }) {
  const style = KIND_STYLE[item.kind] ?? KIND_STYLE.info
  const Icon = style.icon
  return (
    <div className="flex items-start gap-2.5">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.className)} aria-label={style.label} />
      <div className="min-w-0">
        {/* Plain prose; the ways out of a point (the list that answers it, the reports it rests on) are small links under it, never the sentence itself dressed as a link. */}
        <p className="text-sm leading-relaxed text-foreground">{item.text}</p>
        {(item.href || item.evidence.length > 0) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {item.href && (
              <Link href={item.href} className="inline-flex min-h-[32px] items-center gap-1.5 text-xs text-primary hover:underline" title="Buka daftarnya">
                <ListChecks className="h-3.5 w-3.5 shrink-0" /> Buka daftarnya
              </Link>
            )}
            {item.evidence.map((evidence) => (
              <Link
                key={evidence.missionId}
                href={evidence.href}
                className="inline-flex min-h-[32px] items-center gap-1.5 text-xs text-primary hover:underline"
                title={`Lihat laporan ${evidence.client}`}
              >
                <FileText className="h-3.5 w-3.5 shrink-0" /> Lihat laporan {evidence.client}
              </Link>
            ))}
          </p>
        )}
      </div>
    </div>
  )
}

function describeWhen(iso: string): string {
  return `Dibuat ${new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))} WIB`
}
