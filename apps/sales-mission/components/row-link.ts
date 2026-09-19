"use client"

import { useRouter } from "next/navigation"
import type { MouseEvent } from "react"

/**
 * A table row that opens its record.
 *
 * The desk tables used to reach a record through a small arrow at the end
 * of the row, and people did not know it was a control: an icon button
 * needs a universally read icon, and "arrow up-right" reads as "opens
 * elsewhere", which it did not. Gmail, HubSpot, Linear and Pipedrive open
 * the record from the row itself, with the name styled as the link for
 * the keyboard and for a new tab. So the row is the link: any click that
 * is not on a control and not a text selection navigates, and a modifier
 * key opens a new tab the way a link would.
 */
export function useRowLink() {
  const router = useRouter()
  return (href: string) => (event: MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest("a, button, input, select, textarea, label, [role='checkbox'], [role='menuitem'], [role='menu'], [data-row-link-ignore]")) return
    if (window.getSelection()?.toString()) return
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener")
      return
    }
    router.push(href)
  }
}
