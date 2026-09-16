"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Data table primitives, on the token system.
 *
 * Material's data table: a header row on a slightly lower surface
 * (surface-container-low), 52dp rows, one hairline between rows, hover as a
 * tonal wash and selection as a primary tint, all from `globals.css` tokens
 * so the table is the same colour family as the rest of the app (the old
 * version hardcoded greys and light blues nobody else used). Sticky
 * columns rely on `border-separate`, and their backgrounds are opaque
 * mixes so scrolled content never bleeds through.
 */

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full">
      <table
        data-slot="table"
        className={cn("w-full border-separate border-spacing-0 caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("sticky top-0 z-20", className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child_td]:border-b-0", className)} {...props} />
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("bg-sidebar font-medium [&>tr]:last:border-b-0 [&_td]:border-t [&_td]:border-border", className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "group transition-colors duration-100 hover:[&_td]:bg-muted data-[state=selected]:[&_td]:bg-[color-mix(in_oklab,var(--primary)_8%,var(--card))]",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-11 whitespace-nowrap border-b border-border bg-sidebar px-4 text-left align-middle text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground select-none [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "h-13 border-b border-border/70 bg-card px-4 align-middle text-sm text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
