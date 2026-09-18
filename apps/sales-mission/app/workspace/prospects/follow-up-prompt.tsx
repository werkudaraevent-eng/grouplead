"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "@/components/icons"
import { logProspectAttempt } from "@/app/actions/prospect-actions"
import { Button } from "@/components/ui/button"
import { ChoiceChip } from "@/components/ui/choice-chip"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { activeStatuses, type ProspectStatus } from "@/lib/prospects/prospect-status"
import { CHANNEL_LABELS, OUTCOME_LABELS, OUTCOMES, suggestedStatusKind, type Channel, type Outcome } from "@/lib/prospects/prospect-schema"
import { PENDING_FOLLOW_UP_EVENT, clearPendingFollowUp, readPendingFollowUp, type PendingFollowUp } from "@/lib/prospects/follow-up-pending"

/**
 * "Bagaimana hasilnya?" — asked when the person is back from a call.
 *
 * Shows once a follow-up was started from the Hubungi menu and the tab is
 * seen again (the phone returns from the dialer or WhatsApp, the desk
 * returns from WhatsApp Web or the mail client; on a desk with nothing to
 * dial, after a moment). One tap answers the outcomes that need nothing
 * else; the ones that need a date or a reason open the full dialog with
 * the channel and outcome already chosen. Never blocks the page: "Nanti"
 * puts it away, and the pending note expires on its own (HubSpot's
 * "Log this call?" after a call; M3 snackbar with action, sized up).
 */

/** Outcomes the prompt can save by itself; the others need the dialog's date or reason. */
const ONE_TAP: ReadonlyArray<Outcome> = ["REACHED", "NO_ANSWER", "WRONG_NUMBER"]

const SHORT_LABELS: Partial<Record<Outcome, string>> = {
  REACHED: "Tersambung",
  WRONG_NUMBER: "Nomor salah",
}

function tomorrowKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(new Date(Date.now() + 86_400_000))
}

export function FollowUpPrompt({
  statuses,
  onDetail,
}: {
  statuses: ProspectStatus[]
  /** Open the full log dialog for an outcome that needs more than a tap. */
  onDetail: (pending: PendingFollowUp, prefill: { channel: Channel; outcome: Outcome }) => void
}) {
  const [pending, setPending] = useState<PendingFollowUp | null>(null)
  const [saving, startSaving] = useTransition()
  const router = useRouter()

  const check = useCallback(() => {
    if (document.visibilityState !== "visible") return
    setPending(readPendingFollowUp())
  }, [])

  useEffect(() => {
    check()
    // Back from the call: the tab becomes visible again, or the window
    // regains focus (WhatsApp Desktop and a mail client take focus without
    // hiding the tab).
    document.addEventListener("visibilitychange", check)
    window.addEventListener("focus", check)
    // Started just now on this page: ask after a moment if nothing took
    // the person away (a desk with no dialer), else on the way back.
    const started = () => {
      window.setTimeout(check, 2500)
    }
    window.addEventListener(PENDING_FOLLOW_UP_EVENT, started)
    return () => {
      document.removeEventListener("visibilitychange", check)
      window.removeEventListener("focus", check)
      window.removeEventListener(PENDING_FOLLOW_UP_EVENT, started)
    }
  }, [check])

  if (!pending) return null

  const dismiss = () => {
    clearPendingFollowUp()
    setPending(null)
  }

  const suggestedStatusId = (outcome: Outcome): string | null => {
    const kind = suggestedStatusKind(outcome)
    // A won status is not set from here; the mission's save sets it.
    if (kind === "won") return null
    const active = activeStatuses(statuses)
    const current = active.find((status) => status.id === pending.statusId)
    return current?.kind === kind ? current.id : (active.find((status) => status.kind === kind)?.id ?? null)
  }

  const answer = (outcome: Outcome) => {
    if (!ONE_TAP.includes(outcome)) {
      const target = pending
      dismiss()
      onDetail(target, { channel: target.channel, outcome })
      return
    }
    startSaving(async () => {
      const result = await logProspectAttempt(pending.prospectId, {
        channel: pending.channel,
        outcome,
        note: "",
        attemptedAt: new Date().toISOString(),
        statusId: suggestedStatusId(outcome),
        nextContactAt: outcome === "NO_ANSWER" ? tomorrowKey() : null,
        lostReason: null,
      })
      if (!result.success) {
        toast.error(result.error ?? "Catatan follow-up gagal disimpan.")
        return
      }
      toast.success(outcome === "NO_ANSWER" ? "Follow-up tercatat · hubungi lagi besok" : "Follow-up tercatat")
      dismiss()
      router.refresh()
    })
  }

  return (
    <div
      role="dialog"
      aria-label="Catat hasil follow-up"
      // Above the phone's navigation bar and its FAB; a card at the desk's corner.
      className="fixed inset-x-4 z-40 rounded-xl border bg-card p-4 shadow-lg bottom-[calc(5rem+env(safe-area-inset-bottom)+5.25rem)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[26rem]"
    >
      <p className="text-sm font-semibold text-foreground">Bagaimana hasilnya?</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{CHANNEL_LABELS[pending.channel]} · {pending.label}</p>
      <div className="mt-3 flex flex-wrap gap-x-2 gap-y-3">
        {OUTCOMES.map((outcome) => (
          <ChoiceChip key={outcome} selected={false} disabled={saving} onClick={() => answer(outcome)}>
            {SHORT_LABELS[outcome] ?? OUTCOME_LABELS[outcome]}
          </ChoiceChip>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{saving && <Loader2 className="h-4 w-4 animate-spin" aria-label="Menyimpan" />}</span>
        <Button type="button" variant="ghost" size="sm" onClick={dismiss} disabled={saving}>
          Nanti
        </Button>
      </div>
    </div>
  )
}
