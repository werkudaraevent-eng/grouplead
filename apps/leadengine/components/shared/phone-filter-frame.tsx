"use client"

import * as React from "react"
import { Check, ChevronRight, SlidersHorizontal } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { BottomSheet, SheetRow } from "@/components/ui/bottom-sheet"
import { useEdgeFade } from "@/hooks/use-edge-fade"
import { cn } from "@/lib/utils"
import { SearchField } from "./search-field"

export interface PhoneFilterSearch {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  "aria-label"?: string
}

/**
 * How a page filters on a phone, the same on every page that does (the
 * lists, the Pipeline, the Dashboard): the search when the page has one,
 * then one outlined "Filter" button carrying the count of what narrows the
 * page, which opens the filters in a modal bottom sheet ("Filter", a line
 * saying the page updates as you go, "Done"); what is applied is repeated
 * under it as one sideways-scrolling row of input chips, each with an ✕,
 * then "Clear all" (Sales Activity's `FilterBarFrame`; M3 filter chips in
 * a modal bottom sheet, input chips for what is applied). A sheet that
 * lists its filters as rows opening their own sheets (`FilterFieldRow`)
 * may also carry "Clear all" as a text button beside "Done"
 * (`clearAllInSheet`), shown while anything is applied.
 *
 * The chip row bleeds to the screen's edge and fades at each edge it can
 * still scroll toward (`edge-fade`); its own 4px above and below are room
 * for the ✕'s grown target and a focus ring, taken back by a negative
 * margin so the rows stay 12px apart.
 */
export function PhoneFilterFrame({
  search,
  count,
  chips,
  onClearAll,
  description,
  children,
  clearAllInSheet = false,
  bleedClassName = "-mx-4 px-4 sm:-mx-6 sm:px-6",
  className,
}: {
  search?: PhoneFilterSearch
  /** What narrows the page: the number on the Filter button. */
  count: number
  /** The applied filters as `FilterChip`s; the row shows while there is one. */
  chips: React.ReactNode[]
  onClearAll: () => void
  /** The sheet's supporting line. */
  description: string
  /** The sheet's body. */
  children: React.ReactNode
  /** "Clear all" also in the sheet's footer, beside "Done", while a chip is shown. */
  clearAllInSheet?: boolean
  /** How far the chip row reaches past the page's gutter to the screen's edge (16px, 24px from `sm`). */
  bleedClassName?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const fadeRef = useEdgeFade<HTMLDivElement>()

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2">
        {search && (
          <SearchField
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder}
            aria-label={search["aria-label"]}
            className="h-11 min-w-0 max-w-none flex-1 basis-auto"
          />
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn("h-11 shrink-0 gap-2", count > 0 && "border-primary/50 bg-primary/5")}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter
          {count > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-primary-foreground">{count}</span>}
        </Button>
      </div>
      {chips.length > 0 && (
        <div
          ref={fadeRef}
          className={cn(
            "edge-fade -my-1 flex items-center overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            bleedClassName,
          )}
        >
          <div className="flex shrink-0 items-center gap-1.5">
            {chips}
            <button type="button" onClick={onClearAll} className="ml-1 shrink-0 whitespace-nowrap text-xs font-semibold text-primary hover:underline">
              Clear all
            </button>
          </div>
        </div>
      )}
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Filter"
        description={description}
        footer={
          <div className="flex items-center gap-2">
            {clearAllInSheet && chips.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={onClearAll}
                className="h-12 shrink-0 px-4 font-semibold text-primary hover:bg-primary/10 hover:text-primary"
              >
                Clear all
              </Button>
            )}
            <Button type="button" className="h-12 min-w-0 flex-1" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        {children}
      </BottomSheet>
    </div>
  )
}

/**
 * One group of choices in a Filter sheet under its M3 list subheader
 * ("Pipeline", "Date range"), 8px from the sheet's edge like the rows in it.
 */
export function FilterSheetSection({
  title,
  hint,
  children,
  className,
}: {
  title: string
  /** A muted line under the subheader. */
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  const id = React.useId()
  return (
    <section aria-labelledby={id} className={cn("px-2 pb-2", className)}>
      <h3 id={id} className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">
        {title}
      </h3>
      {hint && <p className="px-4 pb-2 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </section>
  )
}

/**
 * One filter in a Filter sheet that opens its own sheet over it (the
 * Pipeline's fields; the Dashboard's pipeline, business unit and date
 * range): a 56dp `SheetRow` with the filter's icon, its name, what it is
 * set to under it, a check in the primary colour while it narrows the
 * page, and a chevron (Sales Activity opens a facet's checklist the same
 * way; M3 list in a modal bottom sheet).
 */
export function FilterFieldRow({
  icon,
  label,
  value,
  applied,
  onOpen,
}: {
  icon?: React.ElementType
  label: string
  /** What it is set to, the row's second line. */
  value?: string
  /** It differs from how the page opens: the check. */
  applied: boolean
  onOpen: () => void
}) {
  return (
    <SheetRow
      icon={icon}
      label={label}
      hint={value}
      aria-haspopup="dialog"
      onClick={onOpen}
      trailing={
        <span className="flex shrink-0 items-center gap-1">
          {applied && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
          <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </span>
      }
    />
  )
}
