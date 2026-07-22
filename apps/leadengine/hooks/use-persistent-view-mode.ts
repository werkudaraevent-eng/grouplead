"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * Hook for persisting a view mode toggle (e.g. table/kanban) using a hybrid
 * URL + localStorage strategy:
 *
 *   1. URL search param is authoritative — shareable + browser back/forward
 *      navigates between views.
 *   2. localStorage stores the last explicit choice as a fallback so refresh
 *      without a URL param still respects the user's last preference.
 *   3. The provided `defaultMode` is only used when neither source has a value
 *      (truly first-time use).
 *
 * The hook is SSR-safe: localStorage is never touched during the initial
 * render so it does not desync server and client output.
 */
export function usePersistentViewMode<T extends string>(options: {
    /** Local storage key used for cross-session fallback. */
    storageKey: string
    /** URL search param name (defaults to `view`). */
    queryKey?: string
    /** Allowed values. The hook validates persisted/URL values against this. */
    allowed: readonly T[]
    /** Mode used when nothing is persisted yet. */
    defaultMode: T
}): readonly [T, (next: T) => void] {
    const { storageKey, queryKey = "view", allowed, defaultMode } = options
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const isAllowed = useCallback(
        (value: string | null | undefined): value is T => {
            if (!value) return false
            return (allowed as readonly string[]).includes(value)
        },
        [allowed],
    )

    // Initial value: stay deterministic for SSR by ignoring localStorage on
    // the first render. URL params are available on both server and client.
    const [mode, setMode] = useState<T>(() => {
        const fromUrl = searchParams?.get(queryKey)
        if (isAllowed(fromUrl)) return fromUrl
        return defaultMode
    })

    // After mount, hydrate from localStorage if the URL did not specify a view.
    useEffect(() => {
        const fromUrl = searchParams?.get(queryKey)
        if (isAllowed(fromUrl)) {
            if (fromUrl !== mode) setMode(fromUrl)
            return
        }
        try {
            const stored = window.localStorage.getItem(storageKey)
            if (isAllowed(stored) && stored !== mode) {
                setMode(stored)
            }
        } catch {
            // localStorage unavailable (private mode, etc.) — keep defaults.
        }
        // We intentionally only react to URL changes here. Mode changes are
        // emitted via the setter below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams])

    const updateMode = useCallback(
        (next: T) => {
            if (next === mode) return
            setMode(next)

            // Persist to localStorage.
            try {
                window.localStorage.setItem(storageKey, next)
            } catch {
                // Ignore storage failures — URL still carries the choice.
            }

            // Update the URL search param without scroll/history spam.
            const params = new URLSearchParams(searchParams?.toString() ?? "")
            if (next === defaultMode) {
                params.delete(queryKey)
            } else {
                params.set(queryKey, next)
            }
            const query = params.toString()
            const url = query ? `${pathname}?${query}` : pathname
            router.replace(url, { scroll: false })
        },
        [mode, storageKey, searchParams, queryKey, defaultMode, pathname, router],
    )

    return [mode, updateMode] as const
}
