import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The two Werkudara apps, by the id the code has always used for them
 * ("leadengine" is the CRM, named Group Lead on screen).
 */
export type WerkudaraApp = "leadengine" | "sales-mission"

/**
 * The family's glyphs, from the CRM's public/icons/icon.svg (the funnel)
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
 * An app's icon, drawn as the family is (DESIGN.md, "App icon: one family"):
 * the rounded tile at 22% of its side in the primary colour, the white glyph
 * at 60% of it. Inline rather than an <img> so it takes the tokens. 32px by
 * default with the heavier 2.1 stroke the family uses at that size; a larger
 * tile passes its own size and the 2.0 stroke of 48px.
 *
 * The one mark for an app wherever it is named: the drawer's header, the
 * rail, the phone's top app bar, the app switcher and the transit screen.
 * Never a company's logo: a unit's logo belongs where a unit is chosen.
 * Twin of the CRM's components/layout/app-icon.tsx.
 */
export function AppIcon({ app, className, strokeWidth = 2.1 }: { app: WerkudaraApp; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 512 512" className={cn("h-8 w-8 shrink-0", className)} aria-hidden="true" focusable="false">
      <rect width="512" height="512" rx="112.64" className="fill-primary" />
      <g
        transform="translate(102.4 102.4) scale(12.8)"
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {APP_GLYPHS[app]}
      </g>
    </svg>
  )
}
