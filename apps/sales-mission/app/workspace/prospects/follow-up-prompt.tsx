"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "@/components/icons"
import { logProspectAttempt } from "@/app/actions/prospect-actions"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { ChoiceChip } from "@/components/ui/choice-chip"
import { useCompact } from "@/hooks/use-compact"
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
 * the channel and outcome already chosen.
 *
 * Six answers is not a snackbar, so it does not look like one, and it is
 * not a card either: on a phone it is a modal bottom sheet with a scrim,
 * the surface the Hubungi menu itself uses (HubSpot's and Pipedrive's
 * "Log call?" sheet after a call). A first cut drew it as a card above
 * the bar, on the same white with the same border as the prospect cards,
 * and it read as one more prospect with odd contents. On a desk it is a
 * card at the corner at elevation level 3, without a border, so it sits
 * over the table rather than among its rows. Never traps the person:
 * the scrim, "Nanti" or a swipe put it away, and the note expires on
 * its own.
 */

/** Outcomes the prompt can save by itself; the others need the dialog's date or reason. */
const ONE_TAP: ReadonlyArray<Outcome> = ["REACHED", "NO_ANSWER", "WRONG_NUMBER"]

const SHORT_LABELS: Partial<Record<Outcome, string>> = {
  REACHED: "Tersambung",
  WRONG_NUMBER: "Nomor salah",
}

const TITLE = "Bagaimana hasilnya?"

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
  const compact = useCompact()
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

  const dismiss = () => {
    clearPendingFollowUp()
    setPending(null)
  }

  const suggestedStatusId = (current: PendingFollowUp, outcome: Outcome): string | null => {
    const kind = suggestedStatusKind(outcome)
    // A won status is not set from here; the mission's save sets it.
    if (kind === "won") return null
    const active = activeStatuses(statuses)
    const own = active.find((status) => status.id === current.statusId)
    return own?.kind === kind ? own.id : (active.find((status) => status.kind === kind)?.id ?? null)
  }

  const answer = (outcome: Outcome) => {
    if (!pending) return
    if (!ONE_TAP.includes(outcome)) {
      const target = pending
      dismiss()
      onDetail(target, { channel: target.channel, outcome })
      return
    }
    const target = pending
    startSaving(async () => {
      const result = await logProspectAttempt(target.prospectId, {
        channel: target.channel,
        outcome,
        note: "",
        attemptedAt: new Date().toISOString(),
        statusId: suggestedStatusId(target, outcome),
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

  const subtitle = pending ? `${CHANNEL_LABELS[pending.channel]} · ${pending.label}` : ""

  const chips = (
    <div className="flex flex-wrap gap-x-2 gap-y-3">
      {OUTCOMES.map((outcome) => (
        <ChoiceChip key={outcome} selected={false} disabled={saving} onClick={() => answer(outcome)}>
          {SHORT_LABELS[outcome] ?? OUTCOME_LABELS[outcome]}
        </ChoiceChip>
      ))}
    </div>
  )

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{saving && <Loader2 className="h-4 w-4 animate-spin" aria-label="Menyimpan" />}</span>
      <Button type="button" variant="ghost" size="sm" onClick={dismiss} disabled={saving}>
        Nanti
      </Button>
    </div>
  )

  if (compact) {
    // The sheet stays mounted while closed so it can animate out.
    return (
      <BottomSheet
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open && !saving) dismiss()
        }}
        title={TITLE}
        description={subtitle}
        footer={footer}
      >
        <div className="px-4 pt-2 pb-3">{chips}</div>
      </BottomSheet>
    )
  }

  if (!pending) return null

  return (
    <div
      role="dialog"
      aria-label={TITLE}
      className="fixed right-6 bottom-6 z-40 w-[26rem] rounded-xl bg-popover p-4 shadow-xl ring-1 ring-foreground/10"
    >
      <p className="text-sm font-semibold text-foreground">{TITLE}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
      <div className="mt-3">{chips}</div>
      <div className="mt-3">{footer}</div>
    </div>
  )
}
