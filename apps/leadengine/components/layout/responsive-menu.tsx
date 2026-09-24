"use client"

import Link from "next/link"
import { useState } from "react"
import { Slot } from "radix-ui"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useBelowMd } from "@/hooks/use-compact"
import { cn } from "@/lib/utils"
import type { ChromeMenuItem } from "./page-chrome"

/**
 * The top app bar's overflow menu: an action sheet on a phone, a dropdown
 * from `md` up. Twin of Sales Activity's `components/responsive-menu.tsx`.
 *
 * Material's menu is for a pointer; on a phone the same choices become a
 * bottom sheet of 56dp rows the thumb can hit. The items are data rather
 * than children so the two renderings cannot disagree about what is
 * offered.
 */
export function ResponsiveMenu({
    trigger,
    title,
    items,
}: {
    trigger: React.ReactElement
    title: string
    items: ChromeMenuItem[]
}) {
    const phone = useBelowMd()
    const [open, setOpen] = useState(false)

    if (phone) {
        return (
            <>
                <Slot.Root onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>{trigger}</Slot.Root>
                <BottomSheet open={open} onOpenChange={setOpen} title={title}>
                    <div className="space-y-1 px-2 pb-2">
                        {items.map((item, index) => {
                            const Icon = item.icon
                            const classes = cn(
                                "flex min-h-14 w-full items-center gap-4 rounded-xl px-4 text-left text-sm transition-colors hover:bg-muted",
                                item.danger ? "text-destructive" : "text-foreground",
                            )
                            const body = (
                                <>
                                    {Icon && <Icon className={cn("h-5 w-5 shrink-0", item.danger ? "" : "text-muted-foreground")} aria-hidden="true" />}
                                    <span className="flex-1">{item.label}</span>
                                </>
                            )
                            return item.href ? (
                                <Link key={index} href={item.href} className={classes} onClick={() => setOpen(false)}>{body}</Link>
                            ) : (
                                <button key={index} type="button" className={classes} onClick={() => { setOpen(false); item.onSelect?.() }}>{body}</button>
                            )
                        })}
                    </div>
                </BottomSheet>
            </>
        )
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                {items.map((item, index) => {
                    const Icon = item.icon
                    const danger = item.danger ? "text-destructive focus:text-destructive" : undefined
                    if (item.href) {
                        return (
                            <DropdownMenuItem key={index} asChild className={danger}>
                                <Link href={item.href}>{Icon && <Icon className="h-4 w-4" />} {item.label}</Link>
                            </DropdownMenuItem>
                        )
                    }
                    return (
                        <DropdownMenuItem key={index} onSelect={item.onSelect} className={danger}>
                            {Icon && <Icon className="h-4 w-4" />} {item.label}
                        </DropdownMenuItem>
                    )
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
