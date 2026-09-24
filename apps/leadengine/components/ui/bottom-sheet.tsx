"use client"

import * as React from "react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

/**
 * Material's modal bottom sheet: a surface anchored to the bottom edge with
 * 28dp top corners and a drag handle, for what on a wide screen would be a
 * dialog, a popover or a menu. It never grows past 85% of the viewport; the
 * body scrolls, the title and the footer stay, and the footer clears the
 * home indicator (safe-area inset), so its actions are always reachable.
 * Sales Activity's anatomy (its copy has neither the opaque header nor the
 * keyboard rule below yet).
 *
 * The header (handle, title, supporting line) and the footer are surfaces
 * of their own: opaque, never shrunk by a long body, and painted above it
 * (`z-10` over the body's own `z-0` stacking context), so the body scrolls
 * beneath them and nothing in it can show through, however a phone's
 * browser composites a scrolled layer. Once the body has left its top, a
 * hairline under the header marks the edge it passes under, as a top app
 * bar separates itself once content scrolls under it (M3 top app bar,
 * on scroll); the footer's hairline is always drawn.
 *
 * A sheet never raises the keyboard by itself: when its first control is a
 * text field (a search above a long list), opening it focuses the sheet
 * rather than the field, and the field waits for a tap (M3: a text field
 * takes focus when the person chooses it).
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        onOpenAutoFocus={keepKeyboardDown}
        className={cn("max-h-[85dvh] gap-0 rounded-t-[28px] border-t-0 bg-card p-0 shadow-xl", className)}
      >
        {/* Mounted with each opening, so the hairline starts off. */}
        <BottomSheetFrame title={title} description={description} footer={footer}>
          {children}
        </BottomSheetFrame>
      </SheetContent>
    </Sheet>
  )
}

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
const TEXT_FIELD =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, [contenteditable="true"]'

/** On open, focus the sheet itself instead of a text field that comes first. */
function keepKeyboardDown(event: Event) {
  const sheet = event.currentTarget
  if (!(sheet instanceof HTMLElement)) return
  if (sheet.querySelector<HTMLElement>(TABBABLE)?.matches(TEXT_FIELD)) {
    event.preventDefault()
    sheet.focus({ preventScroll: true })
  }
}

function BottomSheetFrame({
  title,
  description,
  footer,
  children,
}: {
  title: string
  description?: string
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  const [scrolled, setScrolled] = React.useState(false)
  return (
    <>
      <div
        data-slot="bottom-sheet-header"
        data-scrolled={scrolled ? "" : undefined}
        className={cn(
          "relative z-10 shrink-0 rounded-t-[inherit] border-b bg-card transition-colors",
          scrolled ? "border-border" : "border-transparent",
        )}
      >
        <div className="flex justify-center pt-3" aria-hidden="true">
          <span className="h-1 w-8 rounded-full bg-muted-foreground/40" />
        </div>
        <div className="px-6 pt-3 pb-2">
          <SheetTitle className="text-base font-semibold text-foreground">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="mt-0.5 text-sm text-muted-foreground">{description}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">{title}</SheetDescription>
          )}
        </div>
      </div>
      <div
        data-slot="bottom-sheet-body"
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
        className={cn(
          "thin-scrollbar relative z-0 min-h-0 flex-1 overflow-y-auto overscroll-contain",
          !footer && "pb-[max(1rem,env(safe-area-inset-bottom))]",
        )}
      >
        {children}
      </div>
      {footer && (
        <div
          data-slot="bottom-sheet-footer"
          className="relative z-10 shrink-0 border-t bg-card px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          {footer}
        </div>
      )}
    </>
  )
}

/**
 * A 56dp list row inside a sheet: leading icon, label, optional supporting
 * line and trailing element; the current place on the tonal indicator.
 * Same row as Sales Activity's `SheetRow`.
 */
export function SheetRow({
  icon: Icon,
  label,
  hint,
  trailing,
  active,
  className,
  ...props
}: {
  icon?: React.ElementType
  label: string
  hint?: string
  trailing?: React.ReactNode
  active?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-14 w-full items-center gap-4 rounded-xl px-4 text-left text-sm transition-colors disabled:cursor-default disabled:hover:bg-transparent",
        active ? "bg-[var(--tonal)] font-medium text-[var(--tonal-foreground)]" : "text-foreground hover:bg-muted",
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
      {trailing}
    </button>
  )
}
