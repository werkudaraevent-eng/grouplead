"use client"

import { useState } from "react"
import { CalendarDays, Link2 } from "@/components/icons"
import { PageChrome, type ChromeMenuItem } from "@/components/page-chrome"
import { paths } from "@/lib/paths"
import { PublicLinkDialog } from "./public-link-dialog"

/**
 * The calendar's secondary actions on a phone: the public link (admin) and
 * the phone's own calendar feed, behind the top app bar's overflow. Both
 * are done once, not every time the calendar is opened; as two outlined
 * buttons above the grid they pushed the day's list below the fold.
 */
export function CalendarPhoneMenu({ isAdmin, baseUrl }: { isAdmin: boolean; baseUrl: string }) {
  const [linkOpen, setLinkOpen] = useState(false)
  const menu: ChromeMenuItem[] = [
    ...(isAdmin ? [{ label: "Tautan publik", icon: Link2, onSelect: () => setLinkOpen(true) }] : []),
    { label: "Sinkron ke ponsel", icon: CalendarDays, href: paths.myCalendar },
  ]
  return (
    <>
      <PageChrome menu={menu} />
      {isAdmin && <PublicLinkDialog baseUrl={baseUrl} open={linkOpen} onOpenChange={setLinkOpen} trigger={false} />}
    </>
  )
}
