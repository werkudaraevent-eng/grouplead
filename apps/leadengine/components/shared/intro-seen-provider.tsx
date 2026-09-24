"use client"

import * as React from "react"

/**
 * Which page descriptions this person has closed, for every `PageIntro` on
 * the page.
 *
 * Filled on the server by the app layout (`app/(app)/layout.tsx`) from the
 * person's seen marks in public.user_hints that start with `page-intro-`, so
 * a description that was closed on another device is already absent from the
 * first HTML: nothing flashes in and then away. A close made here is added to
 * the set at once, so every other instance of the same key closes with it.
 * With no provider, or an empty list, every description shows, which at
 * worst repeats one sentence.
 */

interface IntroSeenValue {
    has: (key: string) => boolean
    markIntroSeen: (key: string) => void
}

const IntroSeenContext = React.createContext<IntroSeenValue | null>(null)

export function IntroSeenProvider({ initialSeen, children }: { initialSeen: readonly string[]; children: React.ReactNode }) {
    // The server's list can change on a refresh (router.refresh re-renders
    // the layout); the closes made in this tab are kept beside it.
    const fromServer = React.useMemo(() => new Set(initialSeen), [initialSeen])
    const [closedHere, setClosedHere] = React.useState<ReadonlySet<string>>(() => new Set())

    const markIntroSeen = React.useCallback((key: string) => {
        setClosedHere((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
    }, [])

    const value = React.useMemo<IntroSeenValue>(
        () => ({ has: (key) => fromServer.has(key) || closedHere.has(key), markIntroSeen }),
        [fromServer, closedHere, markIntroSeen],
    )

    return <IntroSeenContext.Provider value={value}>{children}</IntroSeenContext.Provider>
}

/** Whether this person has closed the description under `key`. */
export function useIntroSeen(key: string): boolean {
    const ctx = React.useContext(IntroSeenContext)
    return ctx ? ctx.has(key) : false
}

const noop = () => undefined

/** `markIntroSeen(key)`: closes every instance of that description on this page. */
export function useMarkIntroSeen(): (key: string) => void {
    return React.useContext(IntroSeenContext)?.markIntroSeen ?? noop
}
