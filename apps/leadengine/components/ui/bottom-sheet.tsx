"use client"

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

/**
 * Material's modal bottom sheet: a surface anchored to the bottom edge with
 * 28dp top corners and a drag handle, for what on a wide screen would be a
 * dialog, a popover or a menu. It never grows past 85% of the viewport; the
 * body scrolls, the title and the footer stay, and the footer clears the
 * home indicator (safe-area inset), so its actions are always reachable.
 * Same component as Sales Activity's.
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
        className={cn("max-h-[85dvh] gap-0 rounded-t-[28px] border-t-0 bg-card p-0 shadow-xl", className)}
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
        <div
          className={cn(
            "thin-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain",
            !footer && "pb-[max(1rem,env(safe-area-inset-bottom))]",
          )}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>
        )}
      </SheetContent>
    </Sheet>
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
