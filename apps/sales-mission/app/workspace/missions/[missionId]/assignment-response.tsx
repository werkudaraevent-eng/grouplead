"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarClock, Check, Loader2, X } from "lucide-react"
import {
  decideReschedule,
  requestReschedule,
  respondToAssignment,
} from "@/app/actions/assignment-actions"
import { RESPONSE_LABELS } from "@/lib/missions/assignment-workflow"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import type { PendingReschedule } from "@/lib/missions/mission-queries"
import type { AssignmentResponse } from "@/lib/missions/mission-schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function formatProposed(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: MISSION_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

/**
 * Your own answer to an assignment, plus the reschedule proposal form.
 *
 * Sales cannot edit an agreed schedule directly — the client accepted a time.
 * They propose a replacement with a reason and someone decides.
 *
 * Two shapes. As a `banner` it is the first thing on the page while an
 * answer is owed: title, the one sentence that matters, and Terima as the
 * filled button at the trailing edge with the alternatives beside it. Inline,
 * it is the quieter form that lives in the Penugasan card once the answer is
 * given, or when the tenant never asks for one and only Tolak and Minta
 * jadwal ulang remain.
 */
export function AssignmentResponsePanel({
  missionId,
  myResponse,
  defaultDate,
  banner = false,
  confirmationRequired = true,
}: {
  missionId: string
  myResponse: AssignmentResponse
  defaultDate: string
  banner?: boolean
  confirmationRequired?: boolean
}) {
  const [pending, start] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: defaultDate, startTime: "09:30", endTime: "", reason: "" })
  const router = useRouter()

  const respond = (response: "ACCEPTED" | "REJECTED") => {
    start(async () => {
      const result = await respondToAssignment(missionId, response)
      if (result.success) {
        toast.success(response === "ACCEPTED" ? "Penugasan diterima" : "Penugasan ditolak")
        router.refresh()
      } else {
        toast.error(result.error ?? "Gagal menyimpan jawaban")
      }
    })
  }

  const submitReschedule = () => {
    start(async () => {
      const result = await requestReschedule(missionId, form)
      if (result.success) {
        toast.success("Permintaan jadwal ulang terkirim")
        setShowForm(false)
        router.refresh()
      } else {
        toast.error(result.error ?? "Permintaan gagal dikirim")
      }
    })
  }

  const rescheduleForm = showForm && (
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="rs-date">Tanggal usulan</Label>
              <Input id="rs-date" className="h-11" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rs-start">Jam mulai</Label>
              <Input id="rs-start" className="h-11" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rs-end">Jam selesai</Label>
              <Input id="rs-end" className="h-11" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rs-reason">Alasan</Label>
            <textarea
              id="rs-reason"
              rows={3}
              maxLength={1000}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Kenapa jadwalnya perlu diubah?"
              className="w-full rounded-md border border-input bg-field px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>

          <Button size="sm" disabled={pending || !form.reason.trim()} onClick={submitReschedule}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
            Kirim permintaan
          </Button>
        </div>
  )

  const rescheduleButton = (
    <Button
      size={banner ? "default" : "sm"}
      variant="outline"
      disabled={pending || myResponse === "RESCHEDULE_REQUESTED"}
      onClick={() => setShowForm((value) => !value)}
      className={banner ? "h-11" : undefined}
    >
      <CalendarClock className="h-4 w-4" /> Minta jadwal ulang
    </Button>
  )

  const rejectButton = (
    <Button
      size={banner ? "default" : "sm"}
      variant="outline"
      disabled={pending || myResponse === "REJECTED"}
      onClick={() => respond("REJECTED")}
      className={banner ? "h-11" : undefined}
    >
      <X className="h-4 w-4" /> Tolak
    </Button>
  )

  if (banner) {
    return (
      <section
        aria-labelledby="assignment-banner-title"
        className="rounded-xl border border-[var(--warning-foreground)]/25 bg-[var(--warning)] p-5"
      >
        <h2 id="assignment-banner-title" className="text-base font-semibold text-[var(--warning-foreground)]">
          Anda ditugaskan pada mission ini
        </h2>
        <p className="mt-1 text-sm text-[var(--warning-foreground)]">
          Terima kalau Anda bisa berangkat. Kalau tidak, tolak atau usulkan waktu lain.
        </p>
        {/* Primary at the trailing edge; on a phone it sits lowest, nearest
            the thumb, which is what the column-reverse does below sm. */}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {rescheduleButton}
          {rejectButton}
          <Button size="default" className="h-11" disabled={pending} onClick={() => respond("ACCEPTED")}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Terima penugasan
          </Button>
        </div>
        {rescheduleForm && <div className="mt-4">{rescheduleForm}</div>}
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {confirmationRequired ? (
        <p className="text-sm text-muted-foreground">
          Jawaban Anda: <span className="font-semibold text-foreground">{RESPONSE_LABELS[myResponse]}</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {myResponse === "REJECTED"
            ? "Anda menolak penugasan ini."
            : myResponse === "RESCHEDULE_REQUESTED"
              ? "Permintaan jadwal ulang Anda menunggu keputusan."
              : "Penugasan ini milik Anda. Kalau berhalangan, tolak atau usulkan waktu lain."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Terima only reappears after a rejection: with confirmation off there
            is nothing to accept the first time, and re-accepting is how a rep
            takes back a decline. */}
        {(confirmationRequired || myResponse === "REJECTED") && (
          <Button size="sm" disabled={pending || myResponse === "ACCEPTED"} onClick={() => respond("ACCEPTED")}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {myResponse === "REJECTED" ? "Terima kembali" : "Terima"}
          </Button>
        )}
        {rejectButton}
        {rescheduleButton}
      </div>

      {rescheduleForm}
    </div>
  )
}

/** The decision surface for an open request. Primary or admin only. */
export function RescheduleDecision({ request }: { request: PendingReschedule }) {
  const [pending, start] = useTransition()
  const [note, setNote] = useState("")
  const router = useRouter()

  const decide = (decision: "APPROVED" | "REJECTED") => {
    start(async () => {
      const result = await decideReschedule(request.id, decision, note)
      if (result.success) {
        toast.success(decision === "APPROVED" ? "Jadwal diperbarui" : "Permintaan ditolak")
        router.refresh()
      } else {
        toast.error(result.error ?? "Keputusan gagal disimpan")
      }
    })
  }

  return (
    <div className="space-y-4 rounded-lg border border-[var(--warning-foreground)]/20 bg-[var(--warning)] p-4">
      <div>
        <p className="text-sm font-semibold text-[var(--warning-foreground)]">
          {request.requestedByName} meminta jadwal ulang
        </p>
        <p className="mt-1 text-sm text-[var(--warning-foreground)]">
          Usulan: <strong>{formatProposed(request.proposedStart)}</strong>
          {request.proposedEnd ? ` – ${formatProposed(request.proposedEnd).split(", ").pop()}` : ""}
        </p>
        <p className="mt-1.5 text-sm text-[var(--warning-foreground)]">&ldquo;{request.reason}&rdquo;</p>
      </div>

      <Input
        className="h-10 bg-white"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Catatan keputusan (opsional)"
      />

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={() => decide("APPROVED")}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Setujui &amp; pindahkan jadwal
        </Button>
        <Button size="sm" variant="outline" className="bg-white" disabled={pending} onClick={() => decide("REJECTED")}>
          <X className="h-4 w-4" /> Tolak
        </Button>
      </div>

      <p className="text-xs text-[var(--warning-foreground)]/80">
        Menyetujui memindahkan jadwal dan mengembalikan jawaban tim ke &ldquo;menunggu&rdquo; — waktu yang mereka setujui sudah berubah.
      </p>
    </div>
  )
}
