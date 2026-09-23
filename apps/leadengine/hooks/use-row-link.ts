"use client"

import { useRouter } from "next/navigation"
import type { MouseEvent } from "react"

/**
 * A table row (or a phone's card) that opens its record, as Sales
 * Activity's lists do (`components/row-link.ts` there).
 *
 * The row is the link and the name inside it is a real `<Link>`, for the
 * keyboard, for a hover preview of the address and for "open in new tab".
 * Any other click on the row navigates, except on a control inside it (a
 * checkbox, the row menu and its items, a website or social link) or when
 * text is being selected; a modifier key opens a new tab, the way a link
 * would. Gmail, HubSpot, Linear and Pipedrive open a record from its row.
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
