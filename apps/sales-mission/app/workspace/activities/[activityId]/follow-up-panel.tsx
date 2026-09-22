"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Ban, Check, ClipboardList, Loader2, MoreVertical, Plus } from "@/components/icons"
import { cancelFollowUp, createFollowUp, logFollowUp } from "@/app/actions/follow-up-actions"
import { FOLLOW_UP_STATE_LABELS, followUpState, type FollowUp } from "@/lib/missions/follow-ups"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { describeDueDate } from "@/lib/prospects/prospect-schema"
import { AutoTextarea } from "@/components/ui/auto-textarea"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/**
 * Follow-ups on the report card: the chain as a timeline, the open one
 * with "Catat tindak lanjut", and the dialog that closes it the way
 * Pipedrive and HubSpot log an activity: how, how it went, a note, and
 * the next step in the same breath. Nothing here is a page of its own; the
 * record is the page.
 */
export interface ChoiceOption {
  code: string
  label: string
  kind: string
}

export interface Person {
  id: string
  name: string
}

const FIELD_CLASS =
  "flex h-12 w-full rounded-md border border-input bg-field px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function stamp(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
}

function dayOf(day: string) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${day}T00:00:00Z`))
}

/** datetime-local wants local wall time without a zone; the value is sent back as an instant. */
function localNow() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

const STATE_TONE: Record<ReturnType<typeof followUpState>, string> = {
  open: "bg-[var(--tonal)] text-[var(--tonal-foreground)]",
  late: "bg-[var(--warning)] text-[var(--warning-foreground)]",
  done: "bg-[var(--success)] text-[var(--success-foreground)]",
  cancelled: "bg-muted text-muted-foreground",
}

/** The step picker shared by "log and schedule next" and "add one": type, owner, day. */
function NextStepFields({
  idPrefix,
  actionTypes,
  people,
  value,
  onChange,
}: {
  idPrefix: string
  actionTypes: ChoiceOption[]
  people: Person[]
  value: { actionType: string; ownerId: string; dueDate: string }
  onChange: (next: { actionType: string; ownerId: string; dueDate: string }) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-type`} className="text-foreground">Jenis</Label>
        <select id={`${idPrefix}-type`} value={value.actionType} onChange={(event) => onChange({ ...value, actionType: event.target.value })} className={FIELD_CLASS}>
          {actionTypes.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-owner`} className="text-foreground">Penanggung jawab</Label>
        <select id={`${idPrefix}-owner`} value={value.ownerId} onChange={(event) => onChange({ ...value, ownerId: event.target.value })} className={FIELD_CLASS}>
          <option value="">Belum ditentukan</option>
          {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-due`} className="text-foreground">Jatuh tempo</Label>
        <Input id={`${idPrefix}-due`} type="date" value={value.dueDate} onChange={(event) => onChange({ ...value, dueDate: event.target.value })} className="h-12" />
      </div>
    </div>
  )
}

export function FollowUpPanel({
  missionId,
  followUps,
  channels,
  outcomes,
  actionTypes,
  people,
  viewerId,
  canManage,
  today,
  fromReport = null,
}: {
  missionId: string
  followUps: FollowUp[]
  channels: ChoiceOption[]
  outcomes: ChoiceOption[]
  /** Real next actions only; "none" is not a step. */
  actionTypes: ChoiceOption[]
  people: Person[]
  viewerId: string
  /** The report's author or a supervisor: may act on any follow-up here and add one. */
  canManage: boolean
  today: string
  /** The report's own next action, shown when nothing is tracked yet (a report sent while tracking was off). */
  fromReport?: { actionLabel: string; ownerName: string | null; dueDate: string | null } | null
}) {
  const [logging, setLogging] = useState<FollowUp | null>(null)
  const [cancelling, setCancelling] = useState<FollowUp | null>(null)
  const [adding, setAdding] = useState(false)
  const open = followUps.find((item) => item.status === "OPEN") ?? null
  const mayAct = (item: FollowUp) => canManage || item.ownerId === viewerId

  return (
    <div id="tindak-lanjut" className="scroll-mt-16 lg:scroll-mt-24">
      {/* The button sits beside its title, not at the far edge of a wide screen. */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs font-semibold text-muted-foreground">
          Tindak lanjut{followUps.length > 0 ? <span className="font-normal"> · {followUps.length}</span> : null}
        </p>
        {!open && canManage && (
          <Button variant="outline" size="sm" className="h-8" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Tambah tindak lanjut
          </Button>
        )}
      </div>

      {followUps.length === 0 ? (
        fromReport ? (
          <div className="mt-2 rounded-lg border border-dashed px-4 py-3 text-sm">
            <p className="font-semibold text-foreground">{fromReport.actionLabel}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {fromReport.ownerName ?? "Belum ada penanggung jawab"}
              {fromReport.dueDate ? ` · jatuh tempo ${dayOf(fromReport.dueDate)}` : ""} · dari laporan, belum dilacak
            </p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Tidak ada tindak lanjut dari laporan ini.</p>
        )
      ) : (
        <ol className="mt-2 space-y-2">
          {followUps.map((item) => {
            const state = followUpState(item, today)
            const due = item.dueDate ? describeDueDate(item.dueDate, today) : null
            return (
              <li key={item.id} className={cn("rounded-lg border px-4 py-3", state === "open" || state === "late" ? "bg-card" : "bg-muted/30")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                      {item.actionLabel}
                      <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold", STATE_TONE[state])}>{FOLLOW_UP_STATE_LABELS[state]}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.ownerName ?? "Belum ada penanggung jawab"}
                      {item.dueDate && (
                        <>
                          {" · "}
                          <span className={cn(state === "late" && "font-medium text-[var(--warning-foreground)]")}>
                            {state === "open" || state === "late" ? (due?.due ? due.text : `jatuh tempo ${dayOf(item.dueDate)}`) : `jatuh tempo ${dayOf(item.dueDate)}`}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  {item.status === "OPEN" && mayAct(item) && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" onClick={() => setLogging(item)}>
                        <ClipboardList className="h-4 w-4" /> Catat tindak lanjut
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Tindakan lain"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem variant="destructive" onSelect={() => setCancelling(item)}><Ban className="h-4 w-4" /> Batalkan</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
                {/* The status label in the title already says Selesai or Dibatalkan;
                    the body adds only what it does not: the outcome and channel of a
                    logged one, the reason of a cancelled one, then who and when. */}
                {item.status !== "OPEN" && (
                  <div className="mt-2 text-sm text-foreground">
                    {item.status === "DONE" && (
                      <p className="flex flex-wrap items-center gap-x-1.5">
                        <Check className="h-4 w-4 text-[var(--success-foreground)]" />
                        <span className="font-medium">{item.outcomeLabel ?? "Selesai"}</span>
                        {item.channelLabel && <span className="text-muted-foreground">· lewat {item.channelLabel.toLowerCase()}</span>}
                      </p>
                    )}
                    {item.note && <p className={cn("whitespace-pre-wrap text-sm text-muted-foreground", item.status === "DONE" && "mt-1")}>{item.note}</p>}
                    {item.closedAt && (
                      <p className="mt-1 text-xs text-muted-foreground">{item.closedByName ?? "Seseorang"} · {stamp(item.closedAt)}</p>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {logging && (
        <LogDialog
          item={logging}
          channels={channels}
          outcomes={outcomes}
          actionTypes={actionTypes}
          people={people}
          onClose={() => setLogging(null)}
        />
      )}
      {cancelling && <CancelDialog item={cancelling} onClose={() => setCancelling(null)} />}
      {adding && <AddDialog missionId={missionId} actionTypes={actionTypes} people={people} viewerId={viewerId} onClose={() => setAdding(false)} />}
    </div>
  )
}

function LogDialog({
  item,
  channels,
  outcomes,
  actionTypes,
  people,
  onClose,
}: {
  item: FollowUp
  channels: ChoiceOption[]
  outcomes: ChoiceOption[]
  actionTypes: ChoiceOption[]
  people: Person[]
  onClose: () => void
}) {
  const [channel, setChannel] = useState(channels[0]?.code ?? "")
  const [outcome, setOutcome] = useState(outcomes[0]?.code ?? "")
  const [when, setWhen] = useState(localNow())
  const [note, setNote] = useState("")
  const [withNext, setWithNext] = useState(false)
  const [next, setNext] = useState({ actionType: actionTypes[0]?.code ?? "", ownerId: item.ownerId ?? "", dueDate: "" })
  const [pending, start] = useTransition()
  const router = useRouter()
  const dropped = outcomes.find((option) => option.code === outcome)?.kind === "dropped"

  const save = () =>
    start(async () => {
      const result = await logFollowUp(item.id, {
        channel,
        outcome,
        note,
        doneAt: new Date(when).toISOString(),
        next: withNext && !dropped ? { actionType: next.actionType, ownerId: next.ownerId || null, dueDate: next.dueDate || null } : null,
      })
      if (!result.success) {
        toast.error(result.error ?? "Catatan tindak lanjut gagal disimpan.")
        return
      }
      toast.success(result.data?.nextId ? "Tindak lanjut tercatat, langkah berikutnya dibuka." : "Tindak lanjut tercatat.")
      onClose()
      router.refresh()
    })

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Catat tindak lanjut</DialogTitle>
          <DialogDescription>{item.actionLabel}{item.ownerName ? ` · ${item.ownerName}` : ""}. Apa yang terjadi, lalu apa langkah berikutnya.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-foreground">Lewat</Label>
            <div role="radiogroup" className="flex flex-wrap gap-2">
              {channels.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  role="radio"
                  aria-checked={channel === option.code}
                  onClick={() => setChannel(option.code)}
                  className={cn("min-h-10 rounded-full border px-3.5 text-sm font-medium", channel === option.code ? "border-transparent bg-[var(--tonal)] font-semibold text-[var(--tonal-foreground)]" : "bg-card text-foreground hover:bg-muted")}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="follow-up-outcome" className="text-foreground">Hasil</Label>
              <select id="follow-up-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)} className={FIELD_CLASS}>
                {outcomes.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="follow-up-when" className="text-foreground">Kapan</Label>
              <Input id="follow-up-when" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} className="h-12" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="follow-up-note" className="text-foreground">Catatan <span className="font-normal text-muted-foreground">(opsional)</span></Label>
            <AutoTextarea id="follow-up-note" value={note} onChange={(event) => setNote(event.target.value)} minRows={2} maxLength={1000} placeholder="Apa yang dibicarakan, apa yang diminta klien…" />
          </div>
          {/* The next step, optional by the unit's choice: a chain, not a dead end, when there is one. */}
          <div className="space-y-3 rounded-lg border px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="follow-up-next" className="text-sm font-semibold text-foreground">Langkah berikutnya</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {dropped ? "Hasil “tidak dilanjutkan” menutup rangkaian ini." : "Buka tindak lanjut baru dari yang ini, supaya klien tidak hilang di antara dua langkah."}
                </p>
              </div>
              {!dropped && (
                <input id="follow-up-next" type="checkbox" checked={withNext} onChange={(event) => setWithNext(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--tonal-foreground)]" />
              )}
            </div>
            {withNext && !dropped && <NextStepFields idPrefix="follow-up-next" actionTypes={actionTypes} people={people} value={next} onChange={setNext} />}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Batal</Button>
          <Button onClick={save} disabled={pending || !channel || !outcome}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CancelDialog({ item, onClose }: { item: FollowUp; onClose: () => void }) {
  const [note, setNote] = useState("")
  const [pending, start] = useTransition()
  const router = useRouter()
  const cancel = () =>
    start(async () => {
      const result = await cancelFollowUp(item.id, note)
      if (!result.success) {
        toast.error(result.error ?? "Tindak lanjut gagal dibatalkan.")
        return
      }
      toast.success("Tindak lanjut dibatalkan.")
      onClose()
      router.refresh()
    })
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Batalkan tindak lanjut ini?</DialogTitle>
          <DialogDescription>{item.actionLabel} tidak akan dikerjakan. Catatannya tersimpan di riwayat.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-1.5">
          <Label htmlFor="follow-up-cancel-note" className="text-foreground">Alasan <span className="font-normal text-muted-foreground">(opsional)</span></Label>
          <AutoTextarea id="follow-up-cancel-note" value={note} onChange={(event) => setNote(event.target.value)} minRows={2} maxLength={500} />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Kembali</Button>
          <Button variant="destructive" onClick={cancel} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Batalkan tindak lanjut
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddDialog({ missionId, actionTypes, people, viewerId, onClose }: { missionId: string; actionTypes: ChoiceOption[]; people: Person[]; viewerId: string; onClose: () => void }) {
  const [value, setValue] = useState({ actionType: actionTypes[0]?.code ?? "", ownerId: viewerId, dueDate: "" })
  const [pending, start] = useTransition()
  const router = useRouter()
  const save = () =>
    start(async () => {
      const result = await createFollowUp(missionId, { actionType: value.actionType, ownerId: value.ownerId || null, dueDate: value.dueDate || null })
      if (!result.success) {
        toast.error(result.error ?? "Tindak lanjut gagal dibuat.")
        return
      }
      toast.success("Tindak lanjut dibuka.")
      onClose()
      router.refresh()
    })
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah tindak lanjut</DialogTitle>
          <DialogDescription>Langkah berikutnya untuk klien ini, siapa yang mengerjakan, dan kapan.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <NextStepFields idPrefix="follow-up-add" actionTypes={actionTypes} people={people} value={value} onChange={setValue} />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Batal</Button>
          <Button onClick={save} disabled={pending || !value.actionType}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Buka tindak lanjut
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
