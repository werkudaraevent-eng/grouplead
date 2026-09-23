"use client"

import { useCallback, useEffect, useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { writePreferenceCookie } from "@/lib/preference-cookie"
import type { ListKey } from "@/lib/lists/list-plan"
import { parseListState, rememberedQuery, serializeListState, type ListState, type ListUrlSpec } from "@/lib/lists/list-state"
import { VIEW_COOKIES } from "@/lib/lists/view-cookies"

/** Write the list's remembered view (see lib/lists/view-cookies.ts); "" forgets it. */
export function rememberView(list: ListKey, query: string) {
    try {
        writePreferenceCookie(VIEW_COOKIES[list], query)
    } catch {
        // No cookie store (a sandboxed preview): the list simply is not remembered.
    }
}

/**
 * A list page's view, held in the URL: `state` is parsed from the query on
 * every render, and `update` writes the next one back with
 * `history.replaceState`, which Next.js carries into `useSearchParams`
 * without a server round trip, so typing in the search never waits on the
 * network twice (once for the page, once for the rows). Replace, not push:
 * the Back button leaves the list rather than stepping through every
 * filter, and the page does not scroll. Each change is remembered for the
 * next bare open of the list (see view-cookies.ts).
 *
 * `query` is the canonical query string of the view, the one key the rows
 * are fetched by, so an unrelated parameter never refetches.
 */
export function useListUrl(list: ListKey, spec: ListUrlSpec) {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const raw = searchParams.toString()
    const state = useMemo(() => parseListState(new URLSearchParams(raw), spec), [raw, spec])
    const query = useMemo(() => serializeListState(state, spec).toString(), [state, spec])
    const remembered = useMemo(() => rememberedQuery(state, spec), [state, spec])

    useEffect(() => {
        rememberView(list, remembered)
    }, [list, remembered])

    const update = useCallback(
        (next: ListState | ((current: ListState) => ListState)) => {
            // Read the address as it is now, not as it was when this render
            // happened, so two quick changes (a debounced search landing
            // beside a filter) never undo each other.
            const current = parseListState(new URLSearchParams(window.location.search), spec)
            const target = typeof next === "function" ? next(current) : next
            const qs = serializeListState(target, spec).toString()
            if (qs === serializeListState(current, spec).toString()) return
            // `null` state, as the Next.js docs call it: the router copies its
            // own history entry over and syncs `useSearchParams`. Passing the
            // current state would carry the router's marker and skip the sync.
            window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname)
        },
        [pathname, spec],
    )

    return { state, query, update }
}
