"use client"

import * as React from "react"
import { Search, X } from "@/components/icons"
import { cn } from "@/lib/utils"

/**
 * The toolbar's search field: an outlined field with 8dp corners, leading
 * icon and trailing clear, the same shape as the filter chips beside it and
 * as Sales Activity's list search. Self-contained and fixed-height, so the icon is centred
 * on the field itself, never on whatever the surrounding row stretched to.
 *
 * Typing is debounced before it reaches the page: every keystroke used to
 * re-filter a thousand rows synchronously. The field stays controlled; a
 * value pushed from outside (a saved view, "Clear all") is shown at once.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  className,
  debounceMs = 200,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  debounceMs?: number
  "aria-label"?: string
}) {
  const [text, setText] = React.useState(value)
  const emitted = React.useRef(value)

  React.useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value
      setText(value)
    }
  }, [value])

  React.useEffect(() => {
    if (text === emitted.current) return
    const timer = window.setTimeout(() => {
      emitted.current = text
      onChange(text)
    }, debounceMs)
    return () => window.clearTimeout(timer)
  }, [text, debounceMs, onChange])

  const clear = () => {
    emitted.current = ""
    setText("")
    onChange("")
  }

  return (
    <div className={cn("relative h-9 w-full min-w-[11rem] max-w-[28rem] shrink basis-[22rem]", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder ?? "Search"}
        className="h-full w-full rounded-md border border-input bg-card pl-9 pr-9 text-sm text-foreground shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
