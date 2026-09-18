"use client"

import { useState } from "react"
import { CheckSquare, Upload } from "@/components/icons"
import { PageChrome, type ChromeMenuItem } from "@/components/page-chrome"
import { useSelectionMode } from "@/components/selection-mode"
import { ImportProspects } from "./import-prospects"
import type { Person } from "@/app/workspace/activities/new/people-picker"

/**
 * The prospect list's secondary actions on a phone: Import and "Pilih
 * prospek" behind the top app bar's overflow, as on the activity list.
 * The desk keeps its header button.
 */
export function ProspectsPhoneMenu({
  canCreate,
  canSelect,
  people,
  canAssignOthers,
  viewerId,
}: {
  canCreate: boolean
  canSelect: boolean
  people: Person[]
  canAssignOthers: boolean
  viewerId: string
}) {
  const [importOpen, setImportOpen] = useState(false)
  const { setSelecting } = useSelectionMode()

  const menu: ChromeMenuItem[] = [
    ...(canCreate ? [{ label: "Import dari .xlsx", icon: Upload, onSelect: () => setImportOpen(true) }] : []),
    ...(canSelect ? [{ label: "Pilih prospek", icon: CheckSquare, onSelect: () => setSelecting(true) }] : []),
  ]
  if (menu.length === 0) return null

  return (
    <>
      <PageChrome menu={menu} />
      {canCreate && (
        <ImportProspects people={people} canAssignOthers={canAssignOthers} viewerId={viewerId} open={importOpen} onOpenChange={setImportOpen} trigger={false} />
      )}
    </>
  )
}
