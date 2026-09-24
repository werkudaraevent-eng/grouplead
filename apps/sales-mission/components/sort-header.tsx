"use client"

import { useTransition, type ComponentProps } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowDown, ArrowUp, Loader2 } from "@/components/icons"
import { TableHead } from "@/components/ui/table"
import { sortTitle } from "@/lib/lists/sort-title"
import { cn } from "@/lib/utils"

/**
 * A sortable column header, as Material's data table draws one: the label is
 * the control, an arrow shows the direction, and a column that is not the
 * current sort reveals its arrow only on hover. One column sorts at a time;
 * clicking cycles unsorted → ascending → descending → default. It is the
 * header cell itself, so the sort state sits where assistive technology
 * reads it, `aria-sort` on the column header (LeadEngine's `SortableHead`);
 * `head` carries the cell's own class, style and data (a frozen column's).
 *
 * A header carries the label and the arrow, nothing else. The column that
 * holds the list's default order shows its arrow muted while that order is
 * on, and says what the order is in its tooltip and to a screen reader
 * ("Urutan bawaan: terdekat dulu"); it used to print that as a caption beside
 * the label, which widened the column and read as part of its name.
 *
 * Generic over the list's sort vocabulary: the caller says how to read a
 * sort value and what the next one is. The mission and prospect lists bind
 * their own.
 */
export function SortHeader<S extends string, C extends string>({
  column,
  label,
  sort,
  parts,
  next,
  defaultSort,
  defaultHint,
  align = "left",
  head,
}: {
  column: C
  label: string
  sort: S
  parts: (sort: S) => { column: string; direction: "asc" | "desc" | string }
  next: (column: C, sort: S) => S
  defaultSort: S
  /** The column that carries the default order, and that order in words ("terdekat dulu"), for its tooltip. */
  defaultHint?: { column: C; text: string }
  align?: "left" | "right"
  /** Props for the header cell: a frozen column's class, offset and edge. */
  head?: ComponentProps<typeof TableHead>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const current = parts(sort)
  const active = current.column === column && (current.direction === "asc" || current.direction === "desc")
  const isDefault = sort === defaultSort && defaultHint?.column === column
  const target = next(column, sort)
  const title = sortTitle({ label, target: parts(target), isDefault, hint: defaultHint?.text })
  const go = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (target === defaultSort) params.delete("sort")
    else params.set("sort", target)
    params.delete("page")
    const qs = params.toString()
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }
  // The default order runs the way its column's arrow points: nearest or
  // due first is ascending, newest first (Laporan) descending.
  const Arrow = (active || isDefault) && current.direction === "desc" ? ArrowDown : ArrowUp
  return (
    <TableHead {...head} aria-sort={active ? (current.direction === "asc" ? "ascending" : "descending") : isDefault ? "other" : "none"}>
      <button
        type="button"
        onClick={go}
        title={title}
        className={cn(
          "group/sort inline-flex h-8 items-center gap-1 rounded-md px-1 -mx-1 transition-colors hover:bg-muted hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active && !isDefault && "text-foreground"
        )}
      >
        {label}
        {isDefault && <span className="sr-only">, urutan bawaan: {defaultHint?.text}</span>}
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <Arrow
            aria-hidden="true"
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-opacity",
              isDefault ? "opacity-100 text-muted-foreground" : active ? "opacity-100 text-primary" : "opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60"
            )}
          />
        )}
      </button>
    </TableHead>
  )
}
