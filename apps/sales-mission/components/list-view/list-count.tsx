"use client"

import { listCountText, type ListCountPlace } from "@/lib/lists/list-count"
import { useListView } from "./list-view-provider"

/**
 * The list's count, drawn where the window class puts it: under the search
 * on a phone, at the leading end of the table's footer on a desk, where it
 * speaks only while a filter narrows the list (lib/lists/list-count.ts).
 * The numbers come from the page through `ListViewProvider`, and
 * "Menyaring…" from the provider's one navigation, so both places always
 * agree. A polite live region that stays mounted while empty, so the new
 * count is read out when a filter lands.
 */
export function ListCount({ place, className }: { place: ListCountPlace; className?: string }) {
  const view = useListView()
  if (!view) return null
  const text = listCountText(view.list, view.count, view.filtering, place)
  return (
    <span className={className} aria-live="polite" title={place === "footer" && text ? text : undefined}>
      {text}
    </span>
  )
}
