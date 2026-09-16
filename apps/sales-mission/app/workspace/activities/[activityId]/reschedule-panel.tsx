"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarClock, Loader2 } from "@/components/icons"
import { rescheduleMission, requestReschedule } from "@/app/actions/assignment-actions"
import type { ConflictSettings } from "@/lib/missions/mission-join"
import type { PersonSchedule } from "@/lib/missions/schedule-availability"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { SchedulePicker, type ScheduleValue } from "@/app/workspace/activities/new/schedule-picker"

/**
 * Move or propose a new time, with the team's calendar in view.
 *
 * One component, two verbs. `mode="move"` writes the schedule directly, for
 * the primary when the tenant allows it and for admins. `mode="propose"`
 * files a request for someone else to decide, for supporting sales and for
 * primaries in units that keep scheduling central. The picker is the same
 * either way: nobody should choose a time blind, whichever button they end
 * on.
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

  const submit = () => {
    start(async () => {
      const input = { ...schedule, reason }
      const result = mode === "move"
        ? await rescheduleMission(missionId, input)
        : await requestReschedule(missionId, input)
      if (result.success) {
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
        <textarea
          id="rs-reason"
          rows={2}
          maxLength={1000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={mode === "move" ? "Kenapa jadwalnya dipindah? Tim akan membacanya." : "Kenapa jadwalnya perlu diubah?"}
          className="w-full rounded-md border border-input bg-field px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
