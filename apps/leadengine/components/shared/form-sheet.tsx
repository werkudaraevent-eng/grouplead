"use client"

import * as React from "react"
import { Loader2, XIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

/**
 * The surface a record's create or edit form opens on (Add / Edit company,
 * Add / Edit contact), in the two shapes Material gives a dialog by window
 * size.
 *
 * Below `md` (a phone held upright) it is M3's full-screen dialog: the
 * whole screen (the window's width by `100dvh`), a 56dp header with ✕ at
 * its leading edge and the title, the fields scrolling in one column
 * between it and a bar along the bottom that holds Cancel and the filled
 * primary above the home indicator. That is the shape of Sales Activity's
 * create pages on a phone (`/workspace/activities/new`,
 * `/workspace/prospects/new`): the side sheet it replaces left a strip of
 * the list showing beside it and cut fields off at the right edge. From
 * `md` it is the side sheet it always was, 576px at the right edge (M3
 * side sheet, for medium and expanded windows only).
 *
 * The parts are used in this order inside the form element:
 * `FormSheetContent` > `<form>` > `FormSheetHeader`, `FormSheetBody`,
 * `FormSheetFooter`.
 */
export const FORM_SHEET_CLASS = cn(
    "flex flex-col gap-0 bg-background p-0",
    // Phone: the full-screen dialog.
    "inset-0 h-dvh w-full max-w-none border-0 sm:max-w-none",
    // From md: the side sheet.
    "md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-w-xl md:border-l md:border-border",
)

export function FormSheetContent({ className, ...props }: React.ComponentProps<typeof SheetContent>) {
    return (
        <SheetContent
            side="right"
            // The desk keeps the sheet's own ✕ at its top right; a phone's is
            // the header's leading ✕ (`FormSheetHeader`).
            closeClassName="max-md:hidden"
            className={cn(FORM_SHEET_CLASS, className)}
            {...props}
        />
    )
}

/**
 * The form's title bar. On a phone, M3's full-screen dialog header: 56dp
 * plus the status bar's inset, ✕ (48dp) at the leading edge, the title at
 * the top app bar's 17px, and `action` (an optional link such as Layout)
 * at the trailing edge; the description is read to a screen reader only.
 * From `md`, the side sheet's header as before: title over description,
 * `action` at the trailing edge, clear of the sheet's own ✕.
 */
export function FormSheetHeader({
    title,
    description,
    action,
}: {
    title: string
    description: string
    action?: React.ReactNode
}) {
    return (
        <div className="shrink-0 border-b border-border bg-card pt-[env(safe-area-inset-top)] md:pt-0">
            <div className="flex h-14 items-center gap-1 px-2 md:h-auto md:items-start md:justify-between md:gap-3 md:py-4 md:pl-6 md:pr-12">
                <SheetClose
                    aria-label="Close"
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-muted md:hidden"
                >
                    <XIcon className="h-5 w-5" />
                </SheetClose>
                <div className="min-w-0 flex-1">
                    <SheetTitle className="truncate px-2 text-[17px] font-semibold md:px-0 md:text-base md:tracking-tight">{title}</SheetTitle>
                    <SheetDescription className="mt-0.5 text-xs text-muted-foreground max-md:sr-only">{description}</SheetDescription>
                </div>
                {action}
            </div>
        </div>
    )
}

/** The fields, scrolling between the header and the action bar; 16px gutters on a phone, 24px from `md`. */
export function FormSheetBody({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            className={cn("custom-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 md:px-6 md:py-5", className)}
            {...props}
        />
    )
}

/**
 * The action bar, the form's last row, never scrolling away. On a phone
 * Cancel (text) and the filled primary, which takes the rest of the row, at
 * 48dp and above the home indicator (M3 full-screen dialog; Sales
 * Activity's `FormActionBar`); from `md` the side sheet's footer as before,
 * with the Esc hint at its leading edge.
 */
export function FormSheetFooter({
    onCancel,
    saving,
    submitLabel,
}: {
    onCancel: () => void
    saving: boolean
    /** "Create company", "Save changes". */
    submitLabel: string
}) {
    return (
        <div className="flex shrink-0 items-center gap-3 border-t border-border bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:justify-between md:px-6 md:py-3.5">
            <p className="hidden text-[11px] text-muted-foreground md:block">
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">Esc</kbd>
                <span className="mx-1">to cancel</span>
            </p>
            <div className="flex flex-1 items-center gap-2 md:ml-auto md:flex-none">
                <Button type="button" variant="ghost" onClick={onCancel} className="h-12 md:h-9">
                    Cancel
                </Button>
                <Button type="submit" disabled={saving} className="h-12 flex-1 md:h-9 md:flex-none">
                    {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                    {saving ? "Saving…" : submitLabel}
                </Button>
            </div>
        </div>
    )
}
