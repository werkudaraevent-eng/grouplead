"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarCheck, Loader2, Lock } from "@/components/icons"
import { assignProspects, logProspectAttempt, setProspectStatus } from "@/app/actions/prospect-actions"
import { COLOR_DOT, KIND_LABELS, activeStatuses, wonStatus, type ProspectStatus, type StatusKind } from "@/lib/prospects/prospect-status"
import { CHANNELS, CHANNEL_LABELS, LOST_REASONS, OUTCOMES, OUTCOME_LABELS, suggestedStatusKind, type Channel, type Outcome } from "@/lib/prospects/prospect-schema"
import { PersonPicker, type Person } from "@/app/workspace/activities/new/people-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { paths } from "@/lib/paths"

/**
 * The three short decisions on a prospect, each a dialog: log a contact,
 * change the status, hand it to someone. A dialog rather than a page
 * because each is a few fields and the list is where the person was.
 *
 * "Confirmed" is never picked here. It is the outcome of scheduling the
 * visit, so choosing it hands over to the mission form prefilled from the
 * prospect; the mission's save marks the prospect Confirmed.
 */

const FIELD_CLASS =
  "flex h-12 w-full rounded-md border border-input bg-field px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
const TEXTAREA_CLASS = `${FIELD_CLASS} h-auto min-h-24 py-2.5`

export interface DialogTarget {
  ids: string[]
  /** For the single-prospect dialogs: what to show and where to go. */
  label?: string
  /** Set for a single target so "Confirmed" can lead to the mission form. */
  prospectId?: string
}

function localNow(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function tomorrow(): string {
  const d = new Date(Date.now() + 86_400_000)
  return new Intl.DateTimeFormat("en-CA").format(d)
}

/** Status options grouped by kind; won is shown but hands over to scheduling. */
function StatusChoice({
  statuses,
  value,
  onChange,
  canCreateMission,
}: {
  statuses: ProspectStatus[]
  value: string
  onChange: (statusId: string) => void
  canCreateMission: boolean
}) {
  const groups: StatusKind[] = ["open", "in_progress", "won", "lost"]
  const active = activeStatuses(statuses)
  return (
    <div className="grid gap-1.5">
      {groups.flatMap((kind) =>
        active
          .filter((status) => status.kind === kind)
          .map((status) => {
            const won = status.kind === "won"
            const disabled = won && !canCreateMission
            return (
              <label
                key={status.id}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm transition-colors",
                  value === status.id ? "border-primary bg-primary/5" : "hover:bg-muted",
                  disabled && "cursor-not-allowed opacity-60"
                )}
              >
                <input type="radio" name="status" value={status.id} checked={value === status.id} disabled={disabled} onChange={() => onChange(status.id)} className="sr-only" />
                <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", COLOR_DOT[status.color])} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">{status.label}</span>
                  <span className="block text-xs text-muted-foreground">{KIND_LABELS[status.kind]}{won ? " · dibuat lewat Jadwalkan kunjungan" : ""}</span>
                </span>
                {won && <CalendarCheck className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </label>
            )
          })
      )}
    </div>
  )
}

/** The fields a target kind demands. */
function KindFields({ kind, nextContactAt, setNextContactAt, lostReason, setLostReason }: {
  kind: StatusKind | null
  nextContactAt: string
  setNextContactAt: (v: string) => void
  lostReason: string
  setLostReason: (v: string) => void
}) {
  if (kind === "in_progress" || kind === "open") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor="next-contact" className="text-foreground">Hubungi lagi pada <span className="font-normal text-muted-foreground">(opsional)</span></Label>
        <Input id="next-contact" type="date" value={nextContactAt} onChange={(event) => setNextContactAt(event.target.value)} className="h-12" />
        <p className="text-xs text-muted-foreground">Muncul di Hari ini pada tanggal itu.</p>
      </div>
    )
  }
  if (kind === "lost") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor="lost-reason" className="text-foreground">Alasan <span className="text-[var(--danger-foreground)]" aria-hidden="true">*</span></Label>
        <div className="flex flex-wrap gap-2">
          {LOST_REASONS.map((reason) => (
            <button key={reason} type="button" onClick={() => setLostReason(reason)} aria-pressed={lostReason === reason} className={cn("h-9 rounded-full border px-3 text-sm", lostReason === reason ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted")}>
              {reason}
            </button>
          ))}
        </div>
        <Input id="lost-reason" value={lostReason} onChange={(event) => setLostReason(event.target.value)} placeholder="Atau tulis sendiri" maxLength={300} className="h-12" />
      </div>
    )
  }
  return null
}

export function ChangeStatusDialog({
  target,
  statuses,
  canCreateMission,
  onClose,
}: {
  target: DialogTarget | null
  statuses: ProspectStatus[]
  canCreateMission: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [statusId, setStatusId] = useState("")
  const [nextContactAt, setNextContactAt] = useState("")
  const [lostReason, setLostReason] = useState("")
  const [pending, start] = useTransition()
  const chosen = statuses.find((status) => status.id === statusId) ?? null
  const won = wonStatus(statuses)

  useEffect(() => {
    if (target) { setStatusId(""); setNextContactAt(""); setLostReason("") }
  }, [target])

  const save = () => {
    if (!target || !chosen) return
    start(async () => {
      const result = await setProspectStatus(target.ids, { statusId, nextContactAt: nextContactAt || null, lostReason: lostReason || null })
      if (!result.success) { toast.error(result.error ?? "Status gagal diubah."); return }
      const { changed, skipped } = result.data ?? { changed: 0, skipped: 0 }
      toast.success(skipped > 0 ? `${changed} diubah, ${skipped} dilewati (bukan pemegang atau sudah jadi aktivitas)` : `${changed} prospek diubah ke ${chosen.label}`)
      onClose()
      router.refresh()
    })
  }

  const scheduleHref = target?.prospectId ? paths.newActivity({ prospect: target.prospectId }) : null
  const wantsWon = chosen?.kind === "won"

  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open && !pending) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{target && target.ids.length > 1 ? `Ubah status ${target.ids.length} prospek` : "Ubah status"}</DialogTitle>
          <DialogDescription>
            {target?.label ? `${target.label}. ` : ""}Status bisa diubah kembali kapan saja.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <StatusChoice statuses={statuses} value={statusId} onChange={setStatusId} canCreateMission={canCreateMission} />
          {wantsWon ? (
            <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {target && target.ids.length > 1
                ? "Janji temu berhasil dijadwalkan satu per satu: buka prospeknya lalu Jadwalkan kunjungan."
                : "Janji temu berhasil diberikan saat kunjungannya dijadwalkan. Lanjutkan ke form aktivitas; data prospek sudah terisi."}
            </div>
          ) : (
            <KindFields kind={chosen?.kind ?? null} nextContactAt={nextContactAt} setNextContactAt={setNextContactAt} lostReason={lostReason} setLostReason={setLostReason} />
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Batal</Button>
          {wantsWon && scheduleHref ? (
            <Button asChild>
              <Link href={scheduleHref}><CalendarCheck className="h-4 w-4" /> Jadwalkan kunjungan</Link>
            </Button>
          ) : (
            <Button onClick={save} disabled={pending || !chosen || wantsWon || (chosen?.kind === "lost" && !lostReason.trim())}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan{won && chosen?.id === won.id ? "" : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function LogAttemptDialog({
  target,
  statuses,
  currentStatusId,
  canCreateMission,
  onClose,
}: {
  target: DialogTarget | null
  statuses: ProspectStatus[]
  currentStatusId: string | null
  canCreateMission: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [channel, setChannel] = useState<Channel>("PHONE")
  const [outcome, setOutcome] = useState<Outcome>("REACHED")
  const [note, setNote] = useState("")
  const [when, setWhen] = useState(localNow())
  const [statusId, setStatusId] = useState("")
  const [nextContactAt, setNextContactAt] = useState("")
  const [lostReason, setLostReason] = useState("")
  const [pending, start] = useTransition()
  const active = useMemo(() => activeStatuses(statuses), [statuses])
  const chosen = statuses.find((status) => status.id === statusId) ?? null

  // A prospect already in a status of the suggested kind stays where it is.
  const suggestedStatusId = (value: Outcome) => {
    const kind = suggestedStatusKind(value)
    const current = active.find((status) => status.id === currentStatusId)
    return current?.kind === kind ? current.id : active.find((status) => status.kind === kind)?.id
  }

  // The default outcome gets its suggestion too: the effect below only runs
  // when the outcome changes, and a reached prospect saved as uncontacted
  // because nobody touched the field is the mistake this prevents.
  useEffect(() => {
    if (target) {
      setChannel("PHONE"); setOutcome("REACHED"); setNote(""); setWhen(localNow())
      setStatusId(suggestedStatusId("REACHED") ?? currentStatusId ?? ""); setNextContactAt(""); setLostReason("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, currentStatusId])

  // The outcome suggests where the prospect lands; the person can override.
  useEffect(() => {
    const suggestion = suggestedStatusId(outcome)
    if (suggestion) setStatusId(suggestion)
    if (outcome === "CALLBACK" || outcome === "NO_ANSWER") setNextContactAt((value) => value || tomorrow())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome])

  const wantsWon = chosen?.kind === "won"
  const scheduleHref = target?.prospectId ? paths.newActivity({ prospect: target.prospectId }) : null

  const save = (thenSchedule: boolean) => {
    if (!target?.prospectId) return
    start(async () => {
      const result = await logProspectAttempt(target.prospectId!, {
        channel,
        outcome,
        note,
        attemptedAt: new Date(when).toISOString(),
        // A won status is not set here; the mission's save sets it.
        statusId: wantsWon ? null : statusId || null,
        nextContactAt: nextContactAt || null,
        lostReason: lostReason || null,
      })
      if (!result.success) { toast.error(result.error ?? "Catatan kontak gagal disimpan."); return }
      toast.success("Kontak tercatat")
      onClose()
      if (thenSchedule && scheduleHref) router.push(scheduleHref)
      else router.refresh()
    })
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open && !pending) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Catat kontak</DialogTitle>
          <DialogDescription>{target?.label ?? "Apa yang terjadi saat menghubungi prospek ini."}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-foreground">Lewat</Label>
            <div role="radiogroup" className="grid grid-cols-5 overflow-hidden rounded-lg border">
              {CHANNELS.map((item) => (
                <button key={item} type="button" role="radio" aria-checked={channel === item} onClick={() => setChannel(item)} className={cn("h-11 border-r text-xs font-medium last:border-r-0 sm:text-sm", channel === item ? "bg-[var(--tonal)] font-semibold text-[var(--tonal-foreground)]" : "bg-card text-foreground hover:bg-muted")}>
                  {CHANNEL_LABELS[item]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="attempt-outcome" className="text-foreground">Hasil</Label>
              <select id="attempt-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value as Outcome)} className={FIELD_CLASS}>
                {OUTCOMES.map((item) => <option key={item} value={item}>{OUTCOME_LABELS[item]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attempt-when" className="text-foreground">Kapan</Label>
              <Input id="attempt-when" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} className="h-12" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="attempt-note" className="text-foreground">Catatan <span className="font-normal text-muted-foreground">(opsional)</span></Label>
            <textarea id="attempt-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={1000} placeholder="Apa yang dibicarakan, siapa yang diminta dihubungi lagi…" className={TEXTAREA_CLASS} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="attempt-status" className="text-foreground">Status setelah ini</Label>
            <select id="attempt-status" value={statusId} onChange={(event) => setStatusId(event.target.value)} className={FIELD_CLASS}>
              {active.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
            </select>
          </div>
          {wantsWon ? (
            <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Janji temu berhasil diberikan saat kunjungannya dijadwalkan. Simpan catatan ini, lalu lanjut ke form aktivitas yang sudah terisi.</span>
            </div>
          ) : (
            <KindFields kind={chosen?.kind ?? null} nextContactAt={nextContactAt} setNextContactAt={setNextContactAt} lostReason={lostReason} setLostReason={setLostReason} />
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Batal</Button>
          {wantsWon ? (
            <Button onClick={() => save(true)} disabled={pending || !canCreateMission}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
              Simpan lalu jadwalkan
            </Button>
          ) : (
            <Button onClick={() => save(false)} disabled={pending || (chosen?.kind === "lost" && !lostReason.trim())}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AssignDialog({
  target,
  people,
  viewerId,
  onClose,
}: {
  target: DialogTarget | null
  people: Person[]
  viewerId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [ownerId, setOwnerId] = useState(viewerId)
  const [pending, start] = useTransition()

  useEffect(() => { if (target) setOwnerId(viewerId) }, [target, viewerId])

  const save = (owner: string | null) => {
    if (!target) return
    start(async () => {
      const result = await assignProspects(target.ids, owner)
      if (!result.success) { toast.error(result.error ?? "Penugasan gagal."); return }
      const { changed, skipped } = result.data ?? { changed: 0, skipped: 0 }
      toast.success(owner ? `${changed} prospek ditugaskan${skipped ? `, ${skipped} dilewati` : ""}` : `${changed} prospek dilepas`)
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open && !pending) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{target && target.ids.length > 1 ? `Tugaskan ${target.ids.length} prospek` : "Tugaskan prospek"}</DialogTitle>
          <DialogDescription>Pemegang adalah orang yang menghubungi dan mengubah statusnya.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-1.5">
          <Label htmlFor="assign-owner" className="text-foreground">Pemegang</Label>
          <PersonPicker id="assign-owner" name="ownerId" people={people} value={ownerId} onChange={setOwnerId} placeholder="Pilih orang" />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => save(null)} disabled={pending}>Lepas pemegang</Button>
          <Button variant="outline" onClick={onClose} disabled={pending}>Batal</Button>
          <Button onClick={() => save(ownerId)} disabled={pending || !ownerId}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Tugaskan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
