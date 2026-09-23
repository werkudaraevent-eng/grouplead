"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { PageBar } from "@/lib/usage/usage-stats"
import { cn } from "@/lib/utils"

/**
 * Most opened pages as a bar list: label, count and share on one line, the
 * bar under it. Google Analytics, Plausible and Vercel Analytics use this
 * shape for "top N by category" because the numbers read without a tooltip
 * and a phone fits a dozen rows; Sales Activity's Pemakaian shows its pages
 * the same way. The bar is a bar, not a progress indicator: 8px tall, 2px
 * corners, no track behind it (a full-width track means "of 100%", which is
 * a meter's message, not a count's), its length relative to the longest
 * row, in the primary like the daily chart above it. The top rows stay,
 * the rest fold into a muted "Other" row, and "Show all" opens the full
 * list in a dialog. Rows do not link: a page's count is the answer here.
 */

const number = new Intl.NumberFormat("en-US")

function BarRow({ row, max }: { row: PageBar; max: number }) {
  const width = max === 0 ? 0 : Math.max((row.value / max) * 100, row.value > 0 ? 1.5 : 0)
  return (
    <li className="rounded-md px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className={cn("min-w-0 flex-1 truncate", row.folded ? "text-muted-foreground" : "text-foreground")} title={row.label}>
          {row.label}
        </span>
        <span className="shrink-0 tabular-nums text-foreground">{number.format(row.value)}</span>
        <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{row.share}%</span>
      </div>
      <div className="mt-1 h-2" aria-hidden="true">
        <div className={cn("h-full rounded-[2px]", row.folded ? "bg-muted-foreground" : "bg-primary")} style={{ width: `${width}%` }} />
      </div>
    </li>
  )
}

export function UsagePages({ rows, all, period }: { rows: PageBar[]; all: PageBar[]; period: number }) {
  const [open, setOpen] = useState(false)
  if (rows.length === 0) return <p className="px-2 py-2 text-[13px] text-muted-foreground">No page was opened in this period.</p>
  const max = all.reduce((highest, row) => Math.max(highest, row.value), 0)
  const hidden = all.length - rows.filter((row) => !row.folded).length
  const list = (items: PageBar[]) => (
    <ol className="space-y-1">
      {items.map((row) => (
        <BarRow key={row.key} row={row} max={max} />
      ))}
    </ol>
  )
  return (
    <div>
      {list(rows)}
      {hidden > 0 && (
        <>
          <Button type="button" variant="ghost" size="sm" className="mt-1 h-11 sm:h-8" onClick={() => setOpen(true)}>
            Show all ({all.length})
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[28rem]">
              <DialogHeader>
                <DialogTitle>All pages</DialogTitle>
                <DialogDescription>
                  {all.length} pages opened in the last {period} days
                </DialogDescription>
              </DialogHeader>
              <DialogBody>{list(all)}</DialogBody>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
