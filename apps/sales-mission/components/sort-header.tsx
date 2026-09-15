"use client"

import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowDown, ArrowUp, Loader2 } from "@/components/icons"
import { cn } from "@/lib/utils"

/**
 * A sortable column header, as Material's data table draws one: the label is
 * the control, an arrow shows the direction, and a column that is not the
 * current sort reveals its arrow only on hover. One column sorts at a time;
 * clicking cycles unsorted → ascending → descending → default.
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
}: {
  column: C
  label: string
  sort: S
  parts: (sort: S) => { column: string; direction: "asc" | "desc" | string }
  next: (column: C, sort: S) => S
  defaultSort: S
  /** Small caption shown beside the column that carries the default order. */
  defaultHint?: { column: C; text: string }
  align?: "left" | "right"
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const current = parts(sort)
  const active = current.column === column && (current.direction === "asc" || current.direction === "desc")
  const isDefault = sort === defaultSort && defaultHint?.column === column
  const target = next(column, sort)
  const describe = (value: S) => {
    const p = parts(value)
    if (p.direction !== "asc" && p.direction !== "desc") return defaultHint?.text ?? "urutan bawaan"
    return p.direction === "asc" ? "A ke Z, terlama dulu" : "Z ke A, terbaru dulu"
  }
  const go = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (target === defaultSort) params.delete("sort")
    else params.set("sort", target)
    params.delete("page")
    const qs = params.toString()
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }
  const Arrow = active && current.direction === "desc" ? ArrowDown : ArrowUp
  return (
    <button
      type="button"
      onClick={go}
      aria-sort={active ? (current.direction === "asc" ? "ascending" : "descending") : isDefault ? "other" : "none"}
      title={`Urut ${label.toLowerCase()}: ${describe(target)}`}
      className={cn(
        "group/sort inline-flex h-8 items-center gap-1 rounded-md px-1 -mx-1 transition-colors hover:bg-muted hover:text-foreground",
        align === "right" && "flex-row-reverse",
        active && "text-foreground"
      )}
    >
      {label}
      {isDefault && <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">{defaultHint?.text}</span>}
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : (
        <Arrow className={cn("h-3.5 w-3.5 transition-opacity", active ? "opacity-100 text-primary" : "opacity-0 group-hover/sort:opacity-60")} />
      )}
    </button>
  )
}
