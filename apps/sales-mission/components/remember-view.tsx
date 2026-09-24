"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, type ComponentProps } from "react"
import { writePreferenceCookie } from "@/lib/preference-cookie"
import { sanitizeViewString, VIEW_COOKIES, type ListKey } from "@/lib/view-cookies"

/**
 * The browser half of the remembered view (see lib/view-cookies.ts).
 *
 * `RememberView` writes the cookie whenever the list's query changes, so
 * a facet, a chip, a sort or a cleared search all leave a trace. The
 * writes happen before navigation where it matters: a link to the bare
 * list from inside the list ("Bersihkan semua", "Lihat semua")
 * must write an empty memory first, or the server would restore the view
 * the person is trying to leave. `ViewLink` and `rememberView` do that.
 */

export function rememberView(list: ListKey, search: string) {
  writePreferenceCookie(VIEW_COOKIES[list], sanitizeViewString(list, search))
}

export function RememberView({ list }: { list: ListKey }) {
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  useEffect(() => {
    rememberView(list, search)
  }, [list, search])
  return null
}

/** A link into a list that records its query as the remembered view before navigating. */
export function ViewLink({ list, href, onClick, ...props }: ComponentProps<typeof Link> & { list: ListKey; href: string }) {
  return (
    <Link
      href={href}
      onClick={(event) => {
        rememberView(list, href.split("?")[1] ?? "")
        onClick?.(event)
      }}
      {...props}
    />
  )
}
