"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

/**
 * What the phone's top app bar and bottom bar need to know about the page
 * they frame: its title, where "back" goes, and whether the navigation bar
 * should step aside (a long form with its own action bar).
 *
 * Pages are server components and cannot reach into the shell, so each one
 * drops a small client marker (`PageChrome`) that announces these facts on
 * mount and withdraws them on unmount. The shell reads them. Material's top
 * app bar carries the page title; this is how the title gets there without
 * every page writing its header twice.
 */

export interface Chrome {
  title?: string
  backHref?: string
  hideNav?: boolean
}

interface ChromeStore {
  chrome: Chrome
  announce: (partial: Chrome) => () => void
}

const ChromeContext = createContext<ChromeStore | null>(null)

export function PageChromeProvider({ children }: { children: React.ReactNode }) {
  const [chrome, setChrome] = useState<Chrome>({})
  const announce = useCallback((partial: Chrome) => {
    setChrome((prev) => ({ ...prev, ...partial }))
    return () => {
      setChrome((prev) => {
        const next = { ...prev }
        for (const key of Object.keys(partial) as (keyof Chrome)[]) delete next[key]
        return next
      })
    }
  }, [])
  const value = useMemo(() => ({ chrome, announce }), [chrome, announce])
  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>
}

export function usePageChrome(): Chrome {
  return useContext(ChromeContext)?.chrome ?? {}
}

/** Announce facts about the current page to the shell. Renders nothing. */
export function PageChrome({ title, backHref, hideNav }: Chrome) {
  const store = useContext(ChromeContext)
  useEffect(() => {
    if (!store) return
    const partial: Chrome = {}
    if (title !== undefined) partial.title = title
    if (backHref !== undefined) partial.backHref = backHref
    if (hideNav !== undefined) partial.hideNav = hideNav
    return store.announce(partial)
  }, [store, title, backHref, hideNav])
  return null
}
