"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, ChevronLeft, ChevronRight, Minus, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import type { AuditFilter } from "@/lib/audit/audit-queries"
import { AUDIT_TABLE_LABELS, describeAudit, type AuditEvent, type AuditTone } from "@/lib/audit/describe-audit"

const SELECT_CLASS =
  "h-10 rounded-md border border-input bg-field px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-9"

export function ActivityFilters({ filter, people }: { filter: AuditFilter; people: Array<{ id: string; name: string }> }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, start] = useTransition()
  const [q, setQ] = useState(filter.q)
  const first = useRef(true)

  const set = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    // Any change to what is being asked starts again from the first page.
    params.delete("page")
    const qs = params.toString()
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (q.trim() === filter.q) return
    const timer = setTimeout(() => set({ q: q.trim() || null }), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const active = [filter.actorId, filter.tableName, filter.action, filter.from, filter.to, filter.q].filter(Boolean).length

  return (
    <div className="mb-4 flex flex-wrap items-end gap-2">
      <div className="relative min-w-0 flex-1 basis-56">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama perusahaan…" aria-label="Cari" className="h-10 pl-9 md:h-9" />
      </div>
      <select aria-label="Siapa" className={SELECT_CLASS} value={filter.actorId ?? ""} onChange={(e) => set({ actor: e.target.value || null })}>
        <option value="">Semua orang</option>
        {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
      </select>
      <select aria-label="Jenis data" className={SELECT_CLASS} value={filter.tableName ?? ""} onChange={(e) => set({ table: e.target.value || null })}>
        <option value="">Semua data</option>
        {Object.entries(AUDIT_TABLE_LABELS).map(([table, label]) => <option key={table} value={table}>{label[0].toUpperCase() + label.slice(1)}</option>)}
      </select>
      <select aria-label="Aksi" className={SELECT_CLASS} value={filter.action ?? ""} onChange={(e) => set({ action: e.target.value || null })}>
        <option value="">Semua aksi</option>
        <option value="INSERT">Membuat</option>
        <option value="UPDATE">Mengubah</option>
        <option value="DELETE">Menghapus</option>
      </select>
      <div className="flex items-end gap-1.5">
        <div className="space-y-1">
          <Label htmlFor="act-from" className="text-[11px] text-muted-foreground">Dari</Label>
          <Input id="act-from" type="date" className="h-10 w-36 md:h-9" value={filter.from ?? ""} onChange={(e) => set({ from: e.target.value || null })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="act-to" className="text-[11px] text-muted-foreground">Sampai</Label>
          <Input id="act-to" type="date" className="h-10 w-36 md:h-9" value={filter.to ?? ""} onChange={(e) => set({ to: e.target.value || null })} />
        </div>
      </div>
      {active > 0 && (
        <Button variant="ghost" size="sm" className="h-10 md:h-9" onClick={() => { setQ(""); set({ q: null, actor: null, table: null, action: null, from: null, to: null }) }}>
          <X className="h-4 w-4" /> Bersihkan
        </Button>
      )}
    </div>
  )
}

const TONE_ICON: Record<AuditTone, typeof Plus> = { create: Plus, update: Pencil, delete: Trash2, neutral: Minus }
const TONE_CLASS: Record<AuditTone, string> = {
  create: "bg-[var(--success)] text-[var(--success-foreground)]",
  update: "bg-primary/10 text-primary",
  delete: "bg-[var(--danger)] text-[var(--danger-foreground)]",
  neutral: "bg-muted text-muted-foreground",
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: MISSION_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

function Event({ event }: { event: AuditEvent }) {
  const [open, setOpen] = useState(false)
  const described = describeAudit(event.lead)
  const Icon = TONE_ICON[described.tone]
  const actor = event.lead.actorName ?? "Sistem"
  const hasDetail = described.details.length > 0 || event.folded.length > 0
  const folded = event.folded.map((row) => ({ row, described: describeAudit(row) }))

  return (
    <li className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        aria-expanded={hasDetail ? open : undefined}
        className={cn("flex w-full items-start gap-3 px-4 py-3 text-left", hasDetail && "hover:bg-muted/50")}
      >
        <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full", TONE_CLASS[described.tone])}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-foreground">
            <span className="font-semibold">{actor}</span> {described.sentence}
            {event.folded.length > 0 && (
              <span className="text-muted-foreground"> · {event.folded.length} data terkait</span>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {formatWhen(event.lead.createdAt)}
            {event.lead.missionId && event.lead.action !== "DELETE" && (
              <>
                {" · "}
                <Link href={`/workspace/missions/${event.lead.missionId}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  Buka mission
                </Link>
              </>
            )}
          </span>
        </span>
        {hasDetail && <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />}
      </button>

      {open && (
        <div className="space-y-3 border-t bg-muted/30 px-4 py-3 pl-14">
          {described.details.length > 0 && (
            <dl className="grid gap-1 text-xs sm:grid-cols-[10rem_1fr]">
              {described.details.map((detail) => (
                <div key={detail.field} className="contents">
                  <dt className="text-muted-foreground">{detail.field}</dt>
                  <dd className="text-foreground">
                    <span className="text-muted-foreground line-through decoration-muted-foreground/60">{detail.from}</span>
                    {" → "}
                    <span className="font-medium">{detail.to}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {folded.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {folded.map(({ row, described: d }) => (
                <li key={row.id}>· {d.sentence}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}

export function ActivityList({ events, page, hasMore }: { events: AuditEvent[]; page: number; hasMore: boolean }) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const pageHref = (n: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (n > 0) params.set("page", String(n))
    else params.delete("page")
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
        Tidak ada aktivitas yang cocok.
      </div>
    )
  }

  return (
    <>
      <ul className="rounded-xl border bg-card">
        {events.map((event) => <Event key={event.lead.txId} event={event} />)}
      </ul>
      {(page > 0 || hasMore) && (
        <nav className="mt-3 flex items-center justify-between text-sm" aria-label="Halaman">
          {page > 0 ? (
            <Button asChild variant="outline" size="sm"><Link href={pageHref(page - 1)}><ChevronLeft className="h-4 w-4" /> Lebih baru</Link></Button>
          ) : <span />}
          {hasMore && (
            <Button asChild variant="outline" size="sm"><Link href={pageHref(page + 1)}>Lebih lama <ChevronRight className="h-4 w-4" /></Link></Button>
          )}
        </nav>
      )}
    </>
  )
}
