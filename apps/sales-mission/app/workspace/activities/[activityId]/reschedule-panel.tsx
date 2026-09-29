"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarClock, Loader2 } from "@/components/icons"
import { rescheduleMission, requestReschedule } from "@/app/actions/assignment-actions"
import type { ConflictSettings } from "@/lib/missions/mission-join"
import type { PersonSchedule } from "@/lib/missions/schedule-availability"
import { AutoTextarea } from "@/components/ui/auto-textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { SchedulePicker, type ScheduleValue } from "@/app/workspace/activities/new/schedule-picker"
import { catchStaleDeployment } from "@/lib/deploy/stale-announce"
import { mergeDraftValues } from "@/lib/drafts/form-draft"
import { useFormDraft } from "@/hooks/use-form-draft"
import { DraftNotice } from "@/components/draft-notice"

/**
 * Move or propose a new time, with the team's calendar in view.
 *
 * One component, two verbs. `mode="move"` writes the schedule directly, for
 * the primary when the tenant allows it and for admins. `mode="propose"`
 * files a request for someone else to decide, for supporting sales and for
 * primaries in units that keep scheduling central. The picker is the same
 * either way: nobody should choose a time blind, whichever button they end
 * on.
 *
 * The new time and the reason are kept in this browser while they are
 * chosen, so a reload gives them back (DESIGN.md, "Surviving a deploy").
 */
export function ReschedulePanel({
  missionId,
  mode,
  initial,
  people,
  settings,
  location,
  onDone,
}: {
  missionId: string
  mode: "move" | "propose"
  initial: ScheduleValue
  people: PersonSchedule[]
  settings: ConflictSettings
  location: string | null
  onDone?: () => void
}) {
  const [schedule, setSchedule] = useState<ScheduleValue>(initial)
  const [reason, setReason] = useState("")
  const [pending, start] = useTransition()
  const router = useRouter()

  const draft = useFormDraft({
    form: mode === "move" ? "pindah-jadwal" : "usul-jadwal",
    record: missionId,
    value: { schedule, reason },
    changed: reason.trim() !== "" || schedule.date !== initial.date || schedule.startTime !== initial.startTime || schedule.endTime !== initial.endTime,
  })
  const restored = draft.restored
  // Once per draft found: a new `initial` from a refreshed page must not undo what was changed since.
  const applied = useRef<unknown>(null)
  useEffect(() => {
    if (!restored || applied.current === restored) return
    applied.current = restored
    const back = mergeDraftValues({ schedule: initial as ScheduleValue, reason: "" }, restored)
    setSchedule(mergeDraftValues(initial, back.schedule))
    setReason(back.reason)
  }, [restored, initial])
  const discardDraft = () => {
    draft.discard()
    setSchedule(initial)
    setReason("")
  }

  const submit = () => {
    start(async () => {
      const input = { ...schedule, reason }
      let result: Awaited<ReturnType<typeof rescheduleMission>>
      try {
        result = mode === "move"
          ? await rescheduleMission(missionId, input)
          : await requestReschedule(missionId, input)
      } catch (error) {
        // A tab older than the server: the picker keeps its time and reason, the notice asks for a reload.
        if (catchStaleDeployment(error)) return
        throw error
      }
      if (result.success) {
        draft.clear()
        toast.success(mode === "move" ? "Jadwal dipindahkan. Tim sudah diberi tahu." : "Usulan jadwal terkirim.")
        onDone?.()
        router.refresh()
      } else {
        toast.error(result.error ?? "Gagal menyimpan jadwal.")
      }
    })
  }

  return (
    <div className="space-y-4">
      {draft.noticeOpen && <DraftNotice onDismiss={draft.dismiss} onDiscard={discardDraft} />}
      <SchedulePicker
        value={schedule}
        onChange={setSchedule}
        people={people}
        settings={settings}
        location={location}
        missionId={missionId}
        now={new Date()}
        names={{ date: "rs-date", startTime: "rs-start", endTime: "rs-end" }}
      />

      <div className="space-y-1.5">
        <Label htmlFor="rs-reason" className="text-foreground">
          Alasan<span className="ml-0.5 text-[var(--danger-foreground)]" aria-hidden="true">*</span>
        </Label>
        <AutoTextarea
          id="rs-reason"
          minRows={2}
          maxLength={1000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={mode === "move" ? "Kenapa jadwalnya dipindah? Tim akan membacanya." : "Kenapa jadwalnya perlu diubah?"}
        />
      </div>

      <div className="flex justify-end">
        <Button className="h-11" disabled={pending || !reason.trim() || !schedule.startTime} onClick={submit}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
          {mode === "move" ? "Pindahkan jadwal" : "Kirim usulan"}
        </Button>
      </div>
    </div>
  )
}
