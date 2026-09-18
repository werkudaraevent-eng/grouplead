"use client"

import Link from "next/link"
import { useLongPress } from "@/hooks/use-long-press"
import { cn } from "@/lib/utils"

/**
 * The body of a card in a phone list: a link into the record, or, in
 * selection mode, a button that toggles the tick.
 *
 * A long press on the body enters selection mode with this card ticked
 * (Gmail, Google Files, Photos). The press is a gesture here, so the body
 * allows no text selection and no link callout, and the click the browser
 * fires when the finger lifts is swallowed so the press does not also open
 * the record. Buttons belong outside the body, so a tap on one never also
 * opens the page.
 */
export function SelectableCardBody({
  href,
  selecting,
  ticked,
  onTick,
  onLongPress,
  enabled = true,
  className,
  children,
}: {
  href: string
  selecting: boolean
  ticked: boolean
  onTick: (next: boolean) => void
  onLongPress: () => void
  /** Whether a long press does anything (the viewer may pick rows). */
  enabled?: boolean
  className?: string
  children: React.ReactNode
}) {
  const { handlers, consumeClick } = useLongPress(onLongPress, { enabled: enabled && !selecting })
  const classes = cn(
    "block min-w-0 flex-1 select-none p-4 text-left transition-colors hover:bg-muted/50 [-webkit-touch-callout:none]",
    selecting && "pl-2",
    className
  )
  if (selecting) {
    return (
      <button type="button" onClick={() => onTick(!ticked)} aria-pressed={ticked} className={classes}>
        {children}
      </button>
    )
  }
  return (
    <Link
      href={href}
      className={classes}
      {...handlers}
      onClick={(event) => {
        if (consumeClick()) event.preventDefault()
      }}
    >
      {children}
    </Link>
  )
}
