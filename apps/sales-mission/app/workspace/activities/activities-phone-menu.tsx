"use client"

import { useState } from "react"
import { CheckSquare, Download, Upload } from "@/components/icons"
import { PageChrome, type ChromeMenuItem } from "@/components/page-chrome"
import { ImportMissions } from "./import-missions"
import { useSelectionMode } from "@/components/selection-mode"

/**
 * The activity list's secondary actions on a phone.
 *
 * Export and Import are desk work; a rep in a client's lobby never needs
 * them, and as two outlined buttons above the list they cost a row before
 * the first record. Material keeps a page's secondary actions behind the
 * top app bar's overflow, so that is where they go, with "Pilih aktivitas"
 * beside them for whoever may bin rows. The desk keeps its header buttons.
 */
export function ActivitiesPhoneMenu({
  exportHref,
  exportCount,
  canCreate,
  canDelete,
}: {
  exportHref: string
  exportCount: number
  canCreate: boolean
  canDelete: boolean
}) {
  const [importOpen, setImportOpen] = useState(false)
  const { setSelecting } = useSelectionMode()

  const menu: ChromeMenuItem[] = [
    { label: `Export${exportCount > 0 ? ` (${exportCount})` : ""}`, icon: Download, href: exportHref },
    ...(canCreate ? [{ label: "Import dari .xlsx", icon: Upload, onSelect: () => setImportOpen(true) }] : []),
    ...(canDelete ? [{ label: "Pilih aktivitas", icon: CheckSquare, onSelect: () => setSelecting(true) }] : []),
  ]

  return (
    <>
      <PageChrome menu={menu} />
      {canCreate && <ImportMissions open={importOpen} onOpenChange={setImportOpen} trigger={false} />}
    </>
  )
}
