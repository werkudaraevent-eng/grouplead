"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Link2, Loader2 } from "@/components/icons"
import { createBoardToken } from "@/app/actions/board-token-actions"
import { IssuedLink } from "@/components/issued-link"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

/**
 * A link to this calendar for someone without an account.
 *
 * Management wants to look at the schedule, not to work in it, and giving them
 * accounts to do that costs more than it is worth (Google Calendar's secret
 * address, Calendly's public page). So: a secret link that opens the same
 * calendar read-only, named so it can be recognised, revocable from Pengaturan,
 * and separate from the TV link — a screen link would put a clickable page on a
 * wall, and this one would put a browser page on a director's phone either way.
 *
 * Client names default to on here, unlike the TV: a director reading "PT A•••"
 * learns nothing, and the link goes to a named person rather than a room.
 */
export function PublicLinkDialog({
  baseUrl,
  open: controlledOpen,
  onOpenChange,
  trigger = true,
}: {
  baseUrl: string
  /** Owned from outside when the opener is elsewhere (the phone's overflow menu). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Whether to render the Tautan publik button itself. */
  trigger?: boolean
}) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = controlledOpen ?? ownOpen
  const setOpen = (next: boolean) => {
    setOwnOpen(next)
    onOpenChange?.(next)
  }
  const [label, setLabel] = useState("")
  const [showNames, setShowNames] = useState(true)
  const [issued, setIssued] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const url = issued ? `${baseUrl}/jadwal/${issued}` : null

  const create = () => {
    start(async () => {
      const result = await createBoardToken(label, undefined, showNames, "calendar")
      if (result.success && result.data) setIssued(result.data.token)
      else toast.error(result.error ?? "Tautan gagal dibuat")
    })
  }

  const reset = () => {
    setOpen(false)
    setIssued(null)
    setLabel("")
    setShowNames(true)
  }

  return (
    <>
      {trigger && (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Link2 className="h-4 w-4" /> Tautan publik
        </Button>
      )}
      <Dialog open={open} onOpenChange={(next) => { if (!pending) (next ? setOpen(true) : reset()) }}>
        <DialogContent className="sm:max-w-lg">
          {!issued ? (
            <>
              <DialogHeader>
                <DialogTitle>Buat tautan jadwal</DialogTitle>
                <DialogDescription>
                  Dibuka di browser tanpa login, menampilkan kalender ini dengan jam, klien, lokasi, dan sales — tanpa
                  tombol apa pun. Siapa pun yang memegang tautannya bisa membukanya, jadi kirim hanya ke orang yang
                  memang boleh melihat jadwal tim. Bisa dicabut kapan saja dari Pengaturan → Tautan publik.
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="schedule-label" className="text-foreground">Nama tautan</Label>
                  <Input id="schedule-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Direksi" className="h-11" maxLength={100} />
                  <p className="text-xs text-muted-foreground">Supaya nanti tahu tautan mana yang dicabut.</p>
                </div>
                <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
                  <div>
                    <Label htmlFor="schedule-names" className="text-sm font-semibold text-foreground">Tampilkan nama klien</Label>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Mati: “PT A•••”. Keputusan ini terikat ke tautan dan tidak bisa diubah dari URL.
                    </p>
                  </div>
                  <Switch id="schedule-names" checked={showNames} onCheckedChange={setShowNames} />
                </div>
              </DialogBody>
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
                <DialogTitle>Tautan jadwal siap</DialogTitle>
                <DialogDescription>Salin sekarang. Demi keamanan, tautan ini tidak ditampilkan lagi setelah dialog ditutup.</DialogDescription>
              </DialogHeader>
              <DialogBody>
                <IssuedLink url={url ?? ""} />
              </DialogBody>
              <DialogFooter>
                <Button onClick={reset}>Selesai</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
