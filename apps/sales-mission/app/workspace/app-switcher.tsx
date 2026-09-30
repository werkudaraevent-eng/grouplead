"use client"

import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Check, ExternalLink } from "@/components/icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AppTransit, type WerkudaraApp } from "@/components/app-transit"
import { cn } from "@/lib/utils"

/**
 * Mirror of LeadEngine's app switcher, with the active app swapped. Keep the
 * two in sync — this is the one control that appears identically in both apps,
 * so any drift reads as two unrelated products.
 *
 * Where the menu opens (DESIGN.md, "The drawer: header, app switcher,
 * collapse"): in the expanded drawer it drops from the header, inside the
 * drawer, 8px in from both of its edges, so it covers only the drawer's own
 * links, which nobody is using while switching apps, and never the page.
 * It hangs from this button with its trailing edge on the button's: the
 * header's 8px padding puts that edge 8px from the drawer's, and the menu
 * is the 240px drawer minus both insets, so its leading edge lands 8px from
 * the drawer's too. (Anchoring on the header row instead, through Radix's
 * `virtualRef`, left the menu at the window's corner: the trigger remounts
 * when a custom anchor registers, and the anchor it recorded is gone.) On
 * the collapsed rail there is no room inside, so it opens beside the rail,
 * top-aligned with the button: the one case where it enters the page.
 *
 * Choosing the other app is a full navigation to another origin, so the
 * click gets its feedback here, before the browser takes over: the menu
 * closes and the transit screen covers the page until the new document
 * replaces it. The destination draws the same screen first, so the swap is
 * invisible. Modifier clicks (new tab) are left to the browser.
 */

const leadEngineUrl = process.env.NEXT_PUBLIC_LEADENGINE_URL?.trim() || null

/** The menu's inset from each edge of the drawer (and its gap from the rail). */
const DRAWER_INSET = 8
/** The header is 56px and the button 36px, centred: 10px from its foot to the header's, then 4px of air. */
const BELOW_HEADER = 10 + 4
/** The rail is 60px and the button 36px, centred: 12px from the button to the rail's edge, then the inset. */
const RAIL_GAP = 12 + DRAWER_INSET

function LauncherMark() {
  return (
    <span className="grid h-4 w-4 grid-cols-2 gap-[3px]" aria-hidden="true">
      <span className="rounded-[2px] bg-secondary" />
      <span className="rounded-[2px] bg-primary" />
      <span className="rounded-[2px] bg-accent" />
      <span className="rounded-[2px] bg-[var(--success-foreground)]" />
    </span>
  )
}

/**
 * The family's glyphs, from LeadEngine's public/icons/icon.svg (the funnel)
 * and this app's public/icons/icon.svg (the map pin), on their 24-unit grid.
 */
const APP_GLYPHS: Record<WerkudaraApp, ReactNode> = {
  leadengine: (
    <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />
  ),
  "sales-mission": (
    <>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
}

/**
 * An app's icon at 32px, drawn as the family is (DESIGN.md, "App icon: one
 * family"): the rounded tile at 22% of its side in the primary colour, the
 * white glyph at 60% of it, with the heavier 2.1 stroke the family uses at
 * 32px. Inline rather than an <img> so it takes the tokens.
 */
function AppIcon({ app }: { app: WerkudaraApp }) {
  return (
    <svg viewBox="0 0 512 512" className="h-8 w-8 shrink-0" aria-hidden="true">
      <rect width="512" height="512" rx="112.64" className="fill-primary" />
      <g
        transform="translate(102.4 102.4) scale(12.8)"
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {APP_GLYPHS[app]}
      </g>
    </svg>
  )
}

/** One app's row: the icon, the name, one short line under it. */
function AppRowBody({ app, name, line }: { app: WerkudaraApp; name: string; line: string }) {
  return (
    <>
      <AppIcon app={app} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold leading-[18px] text-sidebar-accent-foreground">{name}</span>
        <span className="block truncate text-[11px] leading-[14px] text-sidebar-foreground">{line}</span>
      </span>
    </>
  )
}

const ROW = "flex items-center gap-2.5 rounded-lg px-2 py-2 outline-none"

/** Cover the page and go. The overlay is cleared if the page comes back from the back-forward cache. */
export function useAppTransit() {
  const [leaving, setLeaving] = useState<WerkudaraApp | null>(null)
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) setLeaving(null)
    }
    window.addEventListener("pageshow", onShow)
    return () => window.removeEventListener("pageshow", onShow)
  }, [])
  const leaveTo = (app: WerkudaraApp, url: string, event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    setLeaving(app)
    // One frame for the overlay to paint before the document is torn down.
    window.setTimeout(() => window.location.assign(url), 80)
  }
  return { leaving, leaveTo }
}

export function AppSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false)
  const { leaving, leaveTo } = useAppTransit()

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sidebar-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring active:scale-[0.96] data-[state=open]:bg-sidebar-accent"
            aria-label="Ganti aplikasi Werkudara"
          >
            <LauncherMark />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side={collapsed ? "right" : "bottom"}
          align={collapsed ? "start" : "end"}
          sideOffset={collapsed ? RAIL_GAP : BELOW_HEADER}
          collisionPadding={DRAWER_INSET}
          className="w-56 rounded-xl border-sidebar-border bg-sidebar p-1.5 text-sidebar-foreground shadow-xl duration-150"
        >
          <p className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground">
            Werkudara apps
          </p>
          {leadEngineUrl ? (
            <a
              href={leadEngineUrl}
              onClick={(event) => {
                setOpen(false)
                leaveTo("leadengine", leadEngineUrl, event)
              }}
              className={cn(ROW, "transition-colors duration-150 hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring")}
            >
              <AppRowBody app="leadengine" name="LeadEngine" line="CRM · ganti aplikasi" />
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground" aria-hidden="true" />
            </a>
          ) : (
            <div aria-disabled="true" className={cn(ROW, "opacity-60")} title="Set NEXT_PUBLIC_LEADENGINE_URL untuk mengaktifkan aplikasi ini">
              <AppRowBody app="leadengine" name="LeadEngine" line="URL aplikasi belum dikonfigurasi" />
            </div>
          )}
          <Link
            href="/workspace"
            onClick={() => setOpen(false)}
            className={cn(ROW, "mt-0.5 bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring")}
          >
            <AppRowBody app="sales-mission" name="Sales Activity" line="Sales lapangan · di sini" />
            <Check className="h-3.5 w-3.5 shrink-0 text-sidebar-primary-foreground" aria-label="Aplikasi saat ini" />
          </Link>
        </PopoverContent>
      </Popover>
      {leaving && createPortal(<AppTransit app={leaving} phase="leaving" />, document.body)}
    </>
  )
}
