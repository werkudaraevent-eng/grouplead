"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, Copy, Loader2, Link2, Link2Off, RefreshCw } from "@/components/icons"
import { createCalendarToken, revokeCalendarToken } from "@/app/actions/calendar-token-actions"
import { Button } from "@/components/ui/button"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { paths } from "@/lib/paths"
import type { CalendarTokenStatus } from "@/lib/calendar/calendar-token-queries"
import type { FeedScope } from "@/lib/calendar/calendar-feed-queries"

/**
 * Making and using the personal feed link.
 *
 * Three states. No link yet: one button. A link just made: the URL, once,
 * with Salin, a one-tap iPhone subscribe (webcal:), and the steps for
 * Google Calendar and Outlook. A link that exists (as a hash): when it
 * was made and last fetched, and the way to replace or stop it.
 */
export function FeedSetup({ scope, existing, origin }: { scope: FeedScope; existing: CalendarTokenStatus | null; origin: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [issued, setIssued] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const feedUrl = issued ? `${origin}${paths.calendarFeed(issued)}` : null
  const webcalUrl = feedUrl ? feedUrl.replace(/^https?:/, "webcal:") : null

  const create = () =>
    start(async () => {
      const result = await createCalendarToken(scope)
      if (!result.success || !result.data) {
        toast.error(result.error ?? "Tautan gagal dibuat")
        return
      }
      setIssued(result.data.token)
      setCopied(false)
      router.refresh()
    })

  const revoke = () =>
    start(async () => {
      const result = await revokeCalendarToken(scope)
      if (!result.success) {
        toast.error(result.error ?? "Tautan gagal dicabut")
        return
      }
      setIssued(null)
      toast.success("Tautan dicabut. Kalender yang berlangganan berhenti diperbarui.")
      router.refresh()
    })

  const copy = async () => {
    if (!feedUrl) return
    try {
      await navigator.clipboard.writeText(feedUrl)
      setCopied(true)
      toast.success("Tautan disalin")
    } catch {
      toast.error("Tidak bisa menyalin otomatis; salin dari kotak di atas.")
    }
  }

  const stamp = (iso: string) =>
    new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))

  if (feedUrl) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--success-foreground)]/25 bg-[var(--success)] p-5">
          <p className="flex items-center gap-2 text-base font-semibold text-[var(--success-foreground)]">
            <Check className="h-5 w-5" aria-hidden="true" /> Tautan dibuat
          </p>
          <p className="mt-1 text-sm text-[var(--success-foreground)]">
            Tautan ini tampil sekali. Salin sekarang; bila hilang, buat tautan baru dari halaman ini.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 select-all break-all rounded-lg border bg-card px-3 py-2.5 font-mono text-xs text-foreground">{feedUrl}</code>
            <Button type="button" variant="outline" onClick={copy} className="h-11 shrink-0 sm:h-10">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Tersalin" : "Salin"}
            </Button>
          </div>
        </div>

        <Steps webcalUrl={webcalUrl!} compact={scope === "team"} />
      </div>
    )
  }

  if (existing) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-5">
          <p className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Link2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Tautan aktif
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Dibuat {stamp(existing.createdAt)}.{" "}
            {existing.lastUsedAt ? `Terakhir diambil kalender ${stamp(existing.lastUsedAt)}.` : "Belum pernah diambil kalender mana pun."}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Tautannya tidak disimpan, jadi tidak bisa ditampilkan lagi. Bila ponsel baru perlu berlangganan, buat tautan baru; yang lama berhenti saat itu juga.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={create} disabled={pending} className="h-11 sm:h-10">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Buat tautan baru
            </Button>
            <Button type="button" variant="outline" onClick={revoke} disabled={pending} className="h-11 sm:h-10">
              <Link2Off className="h-4 w-4" /> Cabut
            </Button>
          </div>
        </div>
        {scope === "own" && <Steps webcalUrl={null} />}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <p className="text-base font-semibold text-foreground">Belum ada tautan</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {scope === "team"
            ? "Satu tautan rahasia untuk kalender tim. Siapa pun yang memegangnya bisa membaca jadwal seluruh tim yang Anda lihat, jadi jangan dibagikan."
            : "Satu tautan rahasia untuk kalender Anda. Siapa pun yang memegangnya bisa membaca jadwal kunjungan Anda, jadi jangan dibagikan."}
        </p>
        <Button type="button" onClick={create} disabled={pending} className="mt-4 h-11 sm:h-10">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Buat tautan
        </Button>
      </div>
      {scope === "own" && <Steps webcalUrl={null} />}
    </div>
  )
}

function Steps({ webcalUrl, compact = false }: { webcalUrl: string | null; compact?: boolean }) {
  const Item = ({ n, children }: { n: number; children: React.ReactNode }) => (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--tonal)] text-xs font-bold text-[var(--tonal-foreground)]">{n}</span>
      <span>{children}</span>
    </li>
  )
  if (compact) {
    return (
      <div className="rounded-xl border bg-card p-5 text-sm text-foreground">
        <p>
          Sama seperti kalender pribadi: <strong>Langganan</strong> di iPhone{webcalUrl ? " (" : ""}
          {webcalUrl && <a href={webcalUrl} className="font-medium text-primary hover:underline">ketuk di sini dari Safari</a>}
          {webcalUrl ? ")" : ""}, <strong>Kalender lain → + → Dari URL</strong> di Google Calendar, <strong>Berlangganan dari web</strong> di Outlook.
        </p>
      </div>
    )
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border bg-card p-5">
        <p className="text-base font-semibold text-foreground">iPhone</p>
        {webcalUrl ? (
          <>
            <Button asChild variant="outline" className="mt-3 h-11 w-full sm:h-10 sm:w-auto">
              <a href={webcalUrl}>Langganan di Kalender iPhone</a>
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">Ketuk dari Safari di iPhone; Kalender menawarkan langganan.</p>
          </>
        ) : (
          <ol className="mt-3 space-y-3 text-sm text-foreground">
            <Item n={1}>Buka <strong>Pengaturan → Kalender → Akun → Tambah Akun → Lainnya</strong>.</Item>
            <Item n={2}>Pilih <strong>Tambah Kalender Langganan</strong>, tempel tautannya.</Item>
          </ol>
        )}
      </div>
      <div className="rounded-xl border bg-card p-5">
        <p className="text-base font-semibold text-foreground">Google Calendar (Android dan web)</p>
        <ol className="mt-3 space-y-3 text-sm text-foreground">
          <Item n={1}>Buka <strong>calendar.google.com</strong> di komputer (aplikasi ponsel belum bisa menambah dari URL).</Item>
          <Item n={2}>Di <strong>Kalender lain</strong>, ketuk <strong>+ → Dari URL</strong>, tempel tautannya. Bukan <strong>Impor</strong>: impor menyalin sekali dan tidak pernah diperbarui.</Item>
          <Item n={3}>Kalender itu lalu tampil di aplikasi Google Calendar di ponsel.</Item>
        </ol>
      </div>
      <div className="rounded-xl border bg-card p-5 md:col-span-2">
        <p className="text-base font-semibold text-foreground">Outlook</p>
        <p className="mt-2 text-sm text-foreground">
          <strong>Tambahkan kalender → Berlangganan dari web</strong>, tempel tautannya.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Satu arah: perubahan di Sales Activity muncul di kalender, bukan sebaliknya. Google menyegarkan setiap beberapa jam; iPhone dan Outlook bisa diatur lebih sering.
        </p>
      </div>
    </div>
  )
}
