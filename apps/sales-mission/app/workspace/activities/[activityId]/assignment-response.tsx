"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarClock, Check, Loader2, X } from "@/components/icons"
import { decideReschedule, respondToAssignment } from "@/app/actions/assignment-actions"
import { RESPONSE_LABELS } from "@/lib/missions/assignment-workflow"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import type { ConflictSettings } from "@/lib/missions/mission-join"
import type { PersonSchedule } from "@/lib/missions/schedule-availability"
import type { PendingReschedule } from "@/lib/missions/mission-queries"
import type { AssignmentResponse } from "@/lib/missions/mission-schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ReschedulePanel } from "./reschedule-panel"
import type { ScheduleValue } from "@/app/workspace/activities/new/schedule-picker"

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

/** What the reschedule button does for this viewer, and what the picker needs. */
export interface RescheduleOptions {
  /** "move" writes the schedule; "propose" files a request for someone to decide. */
  mode: "move" | "propose"
  initial: ScheduleValue
  people: PersonSchedule[]
  settings: ConflictSettings
  location: string | null
}

/**
 * Your own answer to an assignment, plus the way to change its time.
 *
 * Two shapes. As a `banner` it is the first thing on the page while an
 * answer is owed: title, the one sentence that matters, and Terima as the
 * filled button at the trailing edge with the alternatives beside it. Inline,
 * it is the quieter form that lives in the Penugasan card once the answer is
 * given, or when the tenant never asks for one and only Tolak and the
 * schedule remain.
 *
 * The schedule button's verb follows `reschedule.mode`. A primary who may
 * move the visit sees "Pindahkan jadwal" and does it; everyone else sees
 * "Usulkan jadwal lain" and files a request. The old shape asked the primary
 * to request a change from themselves and then approve it.
 */
export function AssignmentResponsePanel({
  missionId,
  myResponse,
  reschedule,
  banner = false,
  confirmationRequired = true,
  selfScheduled = false,
}: {
  missionId: string
  myResponse: AssignmentResponse
  reschedule: RescheduleOptions
  banner?: boolean
  confirmationRequired?: boolean
  /** The viewer scheduled this visit for themself: no answer is owed and Tolak makes no sense. */
  selfScheduled?: boolean
}) {
  const [pending, start] = useTransition()
  const [showForm, setShowForm] = useState(false)
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

  // Moving the slot is an edit and lives on the Ubah form, one door. What
  // remains here is the request path for those who may only propose.
  const canPropose = reschedule.mode === "propose"
  const rescheduleLabel = "Usulkan jadwal lain"

  const rescheduleForm = showForm && (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="mb-3 text-sm font-semibold text-foreground">{rescheduleLabel}</p>
      <ReschedulePanel
        missionId={missionId}
        mode={reschedule.mode}
        initial={reschedule.initial}
        people={reschedule.people}
        settings={reschedule.settings}
        location={reschedule.location}
        onDone={() => setShowForm(false)}
      />
    </div>
  )

  const rescheduleButton = canPropose && (
    <Button
      size={banner ? "default" : "sm"}
      variant="outline"
      disabled={pending || myResponse === "RESCHEDULE_REQUESTED"}
      onClick={() => setShowForm((value) => !value)}
      className={banner ? "h-11" : undefined}
    >
      <CalendarClock className="h-4 w-4" /> {rescheduleLabel}
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
          Anda ditugaskan pada aktivitas ini
        </h2>
        <p className="mt-1 text-sm text-[var(--warning-foreground)]">
          {canPropose
            ? "Terima kalau Anda bisa berangkat. Kalau tidak, tolak atau usulkan waktu lain."
            : "Terima kalau Anda bisa berangkat. Kalau tidak, tolak; kalau waktunya yang salah, gunakan Ubah."}
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

  if (selfScheduled) {
    // Only reachable when the tenant keeps scheduling central: the scheduler
    // may propose, not move. Otherwise the page does not render this at all.
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Anda menjadwalkan kunjungan ini sendiri. Unit bisnis ini memusatkan jadwal di admin, jadi perubahan waktu
          diusulkan; kalau tidak jadi, batalkan aktivitas dari kartu di atas.
        </p>
        <div className="flex flex-wrap gap-2">{rescheduleButton}</div>
        {rescheduleForm}
      </div>
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
              ? "Usulan jadwal Anda menunggu keputusan."
              : canPropose
                ? "Penugasan ini milik Anda. Kalau berhalangan, tolak atau usulkan waktu lain."
                : "Penugasan ini milik Anda. Kalau berhalangan, tolak; kalau waktunya yang salah, gunakan Ubah."}
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
        {rescheduleButton}
        {rejectButton}
      </div>

      {rescheduleForm}
    </div>
  )
}

/** The decision surface for an open request. Primary or admin only. */
export function RescheduleDecision({
  request,
  confirmationRequired,
}: {
  request: PendingReschedule
  confirmationRequired: boolean
}) {
  const [pending, start] = useTransition()
  const [note, setNote] = useState("")
  const router = useRouter()

  const decide = (decision: "APPROVED" | "REJECTED") => {
    start(async () => {
      const result = await decideReschedule(request.id, decision, note)
      if (result.success) {
        toast.success(decision === "APPROVED" ? "Jadwal diperbarui" : "Usulan ditolak")
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
          {request.requestedByName} mengusulkan jadwal lain
        </p>
        <p className="mt-1 text-sm text-[var(--warning-foreground)]">
          Usulan: <strong>{formatProposed(request.proposedStart)}</strong>
          {request.proposedEnd ? ` – ${formatProposed(request.proposedEnd).split(", ").pop()}` : ""}
        </p>
        <p className="mt-1.5 text-sm text-[var(--warning-foreground)]">&ldquo;{request.reason}&rdquo;</p>
      </div>

      <Input
        className="h-10 bg-card"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Catatan keputusan (opsional)"
      />

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={() => decide("APPROVED")}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Setujui &amp; pindahkan jadwal
        </Button>
        <Button size="sm" variant="outline" className="bg-card" disabled={pending} onClick={() => decide("REJECTED")}>
          <X className="h-4 w-4" /> Tolak
        </Button>
      </div>

      <p className="text-xs text-[var(--warning-foreground)]/80">
        {confirmationRequired
          ? "Menyetujui memindahkan jadwal dan meminta tim mengonfirmasi lagi, karena waktu yang mereka setujui sudah berubah."
          : "Menyetujui memindahkan jadwal. Tim diberi tahu waktu barunya."}
      </p>
    </div>
  )
}
