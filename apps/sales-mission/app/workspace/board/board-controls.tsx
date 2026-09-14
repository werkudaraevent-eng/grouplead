"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, Copy, Link2, Loader2, MonitorPlay, Pause, Play, Settings2, SlidersHorizontal } from "@/components/icons"
import { createBoardToken } from "@/app/actions/board-token-actions"
import { FacetSelect } from "@/components/facet-select"
import { PersonAvatar } from "@/components/person-avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  BOARD_PANELS,
  BOARD_PANEL_LABELS,
  BOARD_RANGES,
  BOARD_RANGE_LABELS,
  serializeBoardOptions,
  type BoardOptions,
} from "@/lib/board/board-options"

/**
 * Controls for the board, split the way Material splits them.
 *
 *   - Page actions (BoardActions) sit beside the title, where every other
 *     page keeps its primary action. One filled button opens the screen;
 *     one outlined, admin-only button mints a link, because that is a
 *     credential and deserves a moment's more friction.
 *   - The toolbar (BoardToolbar) is one row: what to show (segmented range,
 *     Sales and Lokasi facets) on the left, and how it is shown (live
 *     status, a "Tampilan" menu of panel toggles) on the right. Panel
 *     toggles are view settings, not filters, so they live in a menu rather
 *     than as four permanently-ticked chips shouting from the bar.
 *
 * Everything the toolbar sets is in the URL, and the actions read it from
 * there: set it up here, send exactly that to the TV.
 */

const INTERVAL_MS = 30_000

function useBoardUrl(options: BoardOptions) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, start] = useTransition()
  const push = (next: BoardOptions) => {
    const qs = serializeBoardOptions(next).toString()
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }
  return { push, pending, router }
}

function Segmented({ value, onChange }: { value: BoardOptions["range"]; onChange: (next: BoardOptions["range"]) => void }) {
  return (
    <div role="radiogroup" aria-label="Rentang" className="inline-flex h-10 rounded-full border bg-card p-0.5 md:h-9">
      {BOARD_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          role="radio"
          aria-checked={value === range}
          onClick={() => onChange(range)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors",
            value === range ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
          )}
        >
          {value === range && <Check className="h-3.5 w-3.5" />}
          {BOARD_RANGE_LABELS[range]}
        </button>
      ))}
    </div>
  )
}

export function BoardToolbar({
  options,
  people,
  locations,
}: {
  options: BoardOptions
  people: Array<{ id: string; name: string; avatarUrl: string | null }>
  locations: string[]
}) {
  const { push, pending, router } = useBoardUrl(options)
  const [running, setRunning] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  // Refresh without reloading: a reload would throw away scroll and focus.
  // The pause exists because auto-updating content nobody can stop is a
  // WCAG 2.2.4 failure.
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => {
      router.refresh()
      setUpdatedAt(new Date())
    }, INTERVAL_MS)
    return () => clearInterval(timer)
  }, [running, router])

  const stamp = updatedAt
    ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(updatedAt)
    : null

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Segmented value={options.range} onChange={(range) => push({ ...options, range })} />
      <FacetSelect
        label="Sales"
        options={people.map((person) => ({ value: person.id, label: person.name }))}
        value={options.sales}
        onChange={(sales) => push({ ...options, sales })}
        renderOption={(option) => {
          const person = people.find((item) => item.id === option.value)
          return (
            <span className="flex min-w-0 items-center gap-2">
              <PersonAvatar name={option.label} avatarUrl={person?.avatarUrl ?? null} size="sm" />
              <span className="truncate">{option.label}</span>
            </span>
          )
        }}
      />
      <FacetSelect
        label="Lokasi"
        options={locations.map((location) => ({ value: location, label: location }))}
        value={options.location}
        onChange={(location) => push({ ...options, location })}
      />

      <span className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setRunning((value) => !value)}
          aria-pressed={running}
          title={running ? "Diperbarui otomatis tiap 30 detik. Klik untuk menjeda." : "Pembaruan dijeda. Klik untuk melanjutkan."}
          className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted md:h-9"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <span
              aria-hidden="true"
              className={cn("h-2 w-2 rounded-full", running ? "bg-[var(--success-foreground)]" : "bg-muted-foreground")}
            />
          )}
          {running ? (stamp ? `Live · ${stamp}` : "Live") : "Dijeda"}
          {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 md:h-9">
              <SlidersHorizontal className="h-4 w-4" /> Tampilan
              {options.panels.length < BOARD_PANELS.length && (
                <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-primary-foreground">
                  {options.panels.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Panel yang tampil</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {BOARD_PANELS.map((panel) => {
              const on = options.panels.includes(panel)
              return (
                <DropdownMenuCheckboxItem
                  key={panel}
                  checked={on}
                  // The last panel cannot be switched off; an empty board is a bug.
                  disabled={on && options.panels.length === 1}
                  onCheckedChange={(next) => {
                    const list = next ? [...options.panels, panel] : options.panels.filter((item) => item !== panel)
                    push({ ...options, panels: BOARD_PANELS.filter((item) => list.includes(item)) })
                  }}
                >
                  {BOARD_PANEL_LABELS[panel]}
                  {panel === "activity" && <span className="ml-auto text-[10px] text-muted-foreground">tidak di TV</span>}
                </DropdownMenuCheckboxItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  )
}

export function BoardActions({ options, isAdmin, baseUrl }: { options: BoardOptions; isAdmin: boolean; baseUrl: string }) {
  const previewHref = `/board?${new URLSearchParams({ ...Object.fromEntries(serializeBoardOptions(options)), names: "1" })}`
  return (
    <>
      {isAdmin && <ScreenLinkDialog options={options} baseUrl={baseUrl} />}
      <Button asChild size="sm">
        <Link href={previewHref} target="_blank" rel="noopener">
          <MonitorPlay className="h-4 w-4" /> Tampilkan di layar
        </Link>
      </Button>
    </>
  )
}

/**
 * Mint a screen link carrying the current options.
 *
 * The one privacy decision, client names, is asked here and bound to the
 * token: the URL carries everything else and can be edited by whoever holds
 * it, so it must not carry this. The link is shown once. Managing and
 * revoking existing links stays in Pengaturan.
 */
function ScreenLinkDialog({ options, baseUrl }: { options: BoardOptions; baseUrl: string }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState("")
  const [showNames, setShowNames] = useState(false)
  const [issued, setIssued] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()

  const url = issued
    ? `${baseUrl}/board?${new URLSearchParams({ token: issued, ...Object.fromEntries(serializeBoardOptions(options)) })}`
    : null

  const create = () => {
    start(async () => {
      const result = await createBoardToken(label, undefined, showNames)
      if (result.success && result.data) setIssued(result.data.token)
      else toast.error(result.error ?? "Tautan gagal dibuat")
    })
  }

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Tidak bisa menyalin otomatis. Blok tautannya lalu salin manual.")
    }
  }

  const reset = () => {
    setOpen(false)
    setIssued(null)
    setLabel("")
    setShowNames(false)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Link2 className="h-4 w-4" /> Buat tautan layar
      </Button>
      <Dialog open={open} onOpenChange={(next) => { if (!pending) (next ? setOpen(true) : reset()) }}>
        <DialogContent className="sm:max-w-lg">
          {!issued ? (
            <>
              <DialogHeader>
                <DialogTitle>Buat tautan layar</DialogTitle>
                <DialogDescription>
                  Tautan membawa rentang, sales, lokasi, dan panel yang sedang Anda lihat. Buka di TV, tanpa login,
                  diperbarui tiap 30 detik. Bisa dicabut kapan saja dari Pengaturan → Papan live.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="screen-label" className="text-foreground">Nama layar</Label>
                  <Input id="screen-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="TV ruang sales lantai 2" className="h-11" maxLength={100} />
                  <p className="text-xs text-muted-foreground">Supaya nanti tahu tautan mana yang dicabut.</p>
                </div>
                <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
                  <div>
                    <Label htmlFor="screen-names" className="text-sm font-semibold text-foreground">Tampilkan nama klien</Label>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Mati: “PT A•••”. Nyalakan hanya untuk layar yang tidak dilewati tamu. Keputusan ini terikat ke tautan dan tidak bisa diubah dari URL.
                    </p>
                  </div>
                  <Switch id="screen-names" checked={showNames} onCheckedChange={setShowNames} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={reset} disabled={pending}>Batal</Button>
                <Button onClick={create} disabled={pending || !label.trim()}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Buat tautan
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Tautan layar siap</DialogTitle>
                <DialogDescription>Salin sekarang. Demi keamanan, tautan ini tidak ditampilkan lagi setelah dialog ditutup.</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <Input readOnly value={url ?? ""} className="h-11 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button onClick={copy} className="h-11 shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Tersalin" : "Salin"}
                </Button>
              </div>
              <DialogFooter className="sm:justify-between">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/workspace/settings/board"><Settings2 className="h-4 w-4" /> Kelola tautan</Link>
                </Button>
                <Button onClick={reset}>Selesai</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
