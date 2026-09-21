"use client"

import { useState } from "react"
import Link from "next/link"
import { MessageCircle, MoreVertical, Pencil, Undo2 } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { RequestClarificationButton, WithdrawReportButton } from "./report-admin-actions"
import { ShareReportButton } from "./share-report-button"

/**
 * The report card's actions: at most two visible, the rest behind ⋮.
 *
 * Four buttons and a status badge used to share one header row and, on a
 * phone, wrapped into a ragged stack that squeezed the title. M3 gives a
 * card one or two actions and an overflow for the rest (Gmail, Drive and
 * HubSpot mobile do the same): the share, which is what a rep does next, and
 * on a desk the edit stay as buttons; asking for clarification and taking
 * the report back, both rare and both a decision, live in the menu; on a
 * phone the edit joins them so the row stays one line. The dialogs are the
 * same ones; only the opener moved.
 */
export function ReportActions({
  missionId,
  authorName,
  leadPushed,
  share,
  editHref,
  canClarify,
  canWithdraw,
}: {
  missionId: string
  authorName: string | null
  leadPushed: boolean
  /** The WhatsApp message and its photo, when the report is sent. */
  share: { text: string; photo: { url: string; name: string } | null } | null
  /** Where "Ubah laporan" goes, when this viewer may. */
  editHref: string | null
  canClarify: boolean
  canWithdraw: boolean
}) {
  const [clarifyOpen, setClarifyOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const overflow = Boolean(editHref) || canClarify || canWithdraw
  if (!share && !overflow) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {share && <ShareReportButton text={share.text} photo={share.photo} />}
      {editHref && (
        <Button asChild variant="outline" size="sm" className="max-sm:hidden">
          <Link href={editHref}><Pencil className="h-4 w-4" /> Ubah laporan</Link>
        </Button>
      )}
      {overflow && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Tindakan lain pada laporan">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {editHref && (
              <DropdownMenuItem asChild className="sm:hidden">
                <Link href={editHref}><Pencil className="h-4 w-4" /> Ubah laporan</Link>
              </DropdownMenuItem>
            )}
            {editHref && (canClarify || canWithdraw) && <DropdownMenuSeparator className="sm:hidden" />}
            {canClarify && (
              <DropdownMenuItem onSelect={() => setClarifyOpen(true)}>
                <MessageCircle className="h-4 w-4" /> Minta klarifikasi
              </DropdownMenuItem>
            )}
            {canWithdraw && (
              <DropdownMenuItem onSelect={() => setWithdrawOpen(true)}>
                <Undo2 className="h-4 w-4" /> Tarik kembali
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {canClarify && <RequestClarificationButton missionId={missionId} authorName={authorName} open={clarifyOpen} onOpenChange={setClarifyOpen} trigger={false} />}
      {canWithdraw && <WithdrawReportButton missionId={missionId} leadPushed={leadPushed} open={withdrawOpen} onOpenChange={setWithdrawOpen} trigger={false} />}
    </div>
  )
}
