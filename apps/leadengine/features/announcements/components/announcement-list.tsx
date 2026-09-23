"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2, RotateCcw } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { reannounce, setAnnouncementEnabled } from "@/app/actions/announcement-actions"
import type { AnnouncementState } from "@/lib/announcements/announcements"

const TIME_ZONE = "Asia/Jakarta"
// A release date is the start of that day in Jakarta, as the seen marks read it.
// Formatted here rather than imported, so the changelog stays out of the client bundle.
const released = (date: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${date}T00:00:00+07:00`),
  )
const stamp = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  )

/**
 * One row per announceable release, newest first: the switch is the whole
 * decision, the text action announces it again. Announcing again reaches
 * every account, so it asks once (M3 dialog for a consequence the person
 * cannot take back). Rows wrap their text on a phone; the switch keeps a
 * 48px hit area at the row's end.
 */
export function AnnouncementList({ items }: { items: AnnouncementState[] }) {
  const [rows, setRows] = useState(items)
  const [confirming, setConfirming] = useState<AnnouncementState | null>(null)
  const [pending, startTransition] = useTransition()

  const toggle = (item: AnnouncementState, enabled: boolean) => {
    setRows((prev) => prev.map((row) => (row.key === item.key ? { ...row, enabled } : row)))
    startTransition(async () => {
      const result = await setAnnouncementEnabled({ key: item.key, enabled })
      if (!result.success) {
        setRows((prev) => prev.map((row) => (row.key === item.key ? { ...row, enabled: !enabled } : row)))
        toast.error(result.error ?? "The announcement setting could not be saved.")
        return
      }
      setRows((prev) => prev.map((row) => (row.key === item.key ? { ...row, configured: true } : row)))
    })
  }

  const again = (item: AnnouncementState) => {
    startTransition(async () => {
      const result = await reannounce({ key: item.key })
      if (!result.success) {
        toast.error(result.error ?? "The announcement could not be sent again.")
        return
      }
      const announcedAt = result.data?.announcedAt ?? new Date().toISOString()
      setRows((prev) =>
        prev.map((row) => (row.key === item.key ? { ...row, enabled: true, announcedAt, reannounced: true, configured: true } : row)),
      )
      setConfirming(null)
      toast.success(`“${item.title}” announced again to every account.`)
    })
  }

  if (rows.length === 0) {
    return <p className="rounded-xl border bg-card px-5 py-6 text-sm text-muted-foreground">No release can be announced yet.</p>
  }

  return (
    <>
      <section className="overflow-clip rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {rows.map((item) => (
            <li key={item.key} className="flex items-start justify-between gap-3 px-4 py-2 sm:gap-4 sm:px-5">
              {/* pt-3.5 puts the title's first line on the switch's centre line. */}
              <div className="min-w-0 flex-1 pt-3.5">
                <Label htmlFor={`announce-${item.key}`} className="block text-sm leading-snug font-semibold break-words text-foreground">
                  {item.title}
                </Label>
                <p className="mt-1 text-sm leading-relaxed break-words text-muted-foreground">{item.body}</p>
                <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  <span>Released {released(item.date)}</span>
                  {item.reannounced && <span>Last announced {stamp(item.announcedAt)}</span>}
                  <button
                    type="button"
                    onClick={() => setConfirming(item)}
                    disabled={pending}
                    className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-semibold lg:min-h-8 text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" /> Announce again
                  </button>
                </div>
              </div>
              {/* The hit area is 48px around the switch, not its 20px track. */}
              <span className="grid size-12 shrink-0 place-items-center">
                <Switch
                  id={`announce-${item.key}`}
                  checked={item.enabled}
                  onCheckedChange={(next) => toggle(item, next)}
                  disabled={pending}
                  className="relative after:absolute after:-inset-3 after:content-['']"
                />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirming(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Announce again to every account?</DialogTitle>
            <DialogDescription>
              The What&apos;s new dialog for “{confirming?.title}” shows once more to everyone when they open the dashboard, including
              people who already closed it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirming(null)} disabled={pending} className="max-lg:h-11">
              Cancel
            </Button>
            <Button type="button" onClick={() => confirming && again(confirming)} disabled={pending} className="max-lg:h-11">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Announce again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
