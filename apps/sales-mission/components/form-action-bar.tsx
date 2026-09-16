"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { PageChrome } from "@/components/page-chrome"

/**
 * The row of buttons that ends a long form.
 *
 * On a phone it is fixed to the bottom of the viewport, opaque, with a top
 * edge, as Material's bottom app bar: a long form puts the send button a
 * long scroll from wherever you finished. Fixed rather than sticky because
 * a sticky bar sits at the bottom of its scroll container, and on a phone
 * that edge is not always the bottom of the screen, which left a strip of
 * fields visible beneath it. A spacer of the bar's own height keeps the
 * last field scrollable above it.
 *
 * From `sm` up it is simply the last row of the form: nothing scrolls
 * beneath it, and a bar parked over the fields would only cover them.
 */
const STATIC_FROM = {
  // A form: the last row of the form from sm up.
  sm: "sm:static sm:inset-auto sm:z-auto sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none",
  // A detail page: the cards carry their own actions once there is room, so
  // the bar simply leaves at the sidebar breakpoint.
  lg: "lg:hidden",
} as const
const SPACER_UNTIL = { sm: "sm:hidden", lg: "lg:hidden" } as const

export function FormActionBar({
  children,
  className,
  until = "sm",
}: {
  children: React.ReactNode
  className?: string
  /** The breakpoint at which the bar stops being fixed to the bottom edge. */
  until?: "sm" | "lg"
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setHeight(element.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      {/* The navigation bar steps aside: a form has one job and one bar. */}
      <PageChrome hideNav />
      <div aria-hidden="true" className={SPACER_UNTIL[until]} style={{ height }} />
      <div
        ref={ref}
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.35)]",
          STATIC_FROM[until],
          className
        )}
      >
        {children}
      </div>
    </>
  )
}
