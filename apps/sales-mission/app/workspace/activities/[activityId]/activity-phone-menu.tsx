"use client"

import { useState } from "react"
import { Ban } from "@/components/icons"
import { PageChrome, type ChromeMenuItem } from "@/components/page-chrome"
import { CancelMissionButton } from "./cancel-mission"

/**
 * The activity page's overflow menu on a phone: the links worth reaching
 * without a scroll, and, last and in the danger ink, calling the visit off.
 * A destructive secondary action lives in the overflow on a phone (Google
 * Calendar's Delete, HubSpot and Salesforce mobile); the desk keeps the
 * question-and-button row in the facts card. The dialog is the same.
 */
export function ActivityPhoneMenu({
  links,
  cancel,
}: {
  links: { label: string; href: string }[]
  /** Present when the viewer may call the visit off. */
  cancel?: { missionId: string; clientName: string }
}) {
  const [cancelOpen, setCancelOpen] = useState(false)
  const menu: ChromeMenuItem[] = [
    ...links,
    ...(cancel ? [{ label: "Batalkan aktivitas", icon: Ban, danger: true, onSelect: () => setCancelOpen(true) }] : []),
  ]
  if (menu.length === 0) return null
  return (
    <>
      <PageChrome menu={menu} />
      {cancel && <CancelMissionButton missionId={cancel.missionId} clientName={cancel.clientName} open={cancelOpen} onOpenChange={setCancelOpen} trigger={false} />}
    </>
  )
}
