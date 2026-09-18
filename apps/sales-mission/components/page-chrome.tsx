"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

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

/**
 * One row of the top app bar's overflow menu: a destination (`href`) or an
 * action (`onSelect`, for a dialog or a mode the page enters).
 */
export interface ChromeMenuItem {
  label: string
  icon?: React.ElementType
  href?: string
  onSelect?: () => void
  /** Drawn in the danger ink: a destructive action, kept last. */
  danger?: boolean
}

export interface Chrome {
  title?: string
  backHref?: string
  hideNav?: boolean
  /** Secondary destinations for the top app bar's overflow menu. */
  menu?: ChromeMenuItem[]
}

type Announce = (partial: Chrome) => () => void

// Two contexts on purpose. `PageChrome` subscribes only to the announcer,
// which never changes; if it subscribed to the values it writes, every
// announcement would re-run its own effect and the page would spin
// forever (which is exactly what happened once).
const ChromeContext = createContext<Chrome>({})
const AnnounceContext = createContext<Announce | null>(null)

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
  return (
    <AnnounceContext.Provider value={announce}>
      <ChromeContext.Provider value={chrome}>{children}</ChromeContext.Provider>
    </AnnounceContext.Provider>
  )
}

export function usePageChrome(): Chrome {
  return useContext(ChromeContext)
}

/** Announce facts about the current page to the shell. Renders nothing. */
export function PageChrome({ title, backHref, hideNav, menu }: Chrome) {
  const announce = useContext(AnnounceContext)
  // Compared by content: a server page builds the array on every render.
  // Only the labels and hrefs take part; an item's handler and icon are
  // functions, so the announced value is the array itself, read through a
  // ref so a re-render with the same content does not re-announce.
  const menuKey = menu ? JSON.stringify(menu.map((item) => [item.label, item.href ?? ""])) : undefined
  const menuRef = useRef(menu)
  menuRef.current = menu
  useEffect(() => {
    if (!announce) return
    const partial: Chrome = {}
    if (title !== undefined) partial.title = title
    if (backHref !== undefined) partial.backHref = backHref
    if (hideNav !== undefined) partial.hideNav = hideNav
    if (menuKey !== undefined) partial.menu = menuRef.current
    return announce(partial)
  }, [announce, title, backHref, hideNav, menuKey])
  return null
}
