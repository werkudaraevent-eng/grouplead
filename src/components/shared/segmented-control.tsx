"use client"

/**
 * Segmented control — pill-tab toggle for small option sets (2–5 items).
 *
 * Why: replacing a `<Select>` for boolean / 3-option fields like
 * "Account Status" (New / Repeater / Contracted). One click vs two,
 * full visibility of choices, and looks crisp.
 *
 * Visual style — pill row with sliding active state:
 *   ┌────────┬──────────┬────────────┐
 *   │  New   │ Repeater │ Contracted │
 *   └────────┴──────────┴────────────┘
 *
 * Implementation — button-based radio group (the same pattern Radix and
 * Headless UI use internally). We deliberately avoid hidden
 * `<input type="radio">` because clicking a label associated with an
 * `sr-only` input triggers the browser's "scroll-focused-element-into-
 * view" behaviour, which inside a scrollable Sheet/Dialog causes the
 * viewport to jump and the layout to "shrink" (footer pops up, content
 * gets clipped). Buttons with `role="radio"` give us identical a11y
 * semantics without that side-effect.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

export interface SegmentedOption<T extends string = string> {
    value: T
    label: string
    /** Optional helper text shown under label on wider variants. */
    description?: string
}

interface SegmentedControlProps<T extends string = string> {
    value: T
    onChange: (value: T) => void
    options: SegmentedOption<T>[]
    name?: string
    disabled?: boolean
    className?: string
    /** Compact mode: tighter padding, smaller text. */
    size?: "sm" | "md"
    "aria-label"?: string
}

export function SegmentedControl<T extends string = string>({
    value,
    onChange,
    options,
    disabled,
    className,
    size = "md",
    ...aria
}: SegmentedControlProps<T>) {
    const padding = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]"

    return (
        <div
            role="radiogroup"
            aria-label={aria["aria-label"]}
            className={cn(
                "inline-flex w-full rounded-lg border border-input bg-muted/50 p-0.5",
                disabled && "opacity-60 pointer-events-none",
                className,
            )}
        >
            {options.map((opt) => {
                const checked = opt.value === value
                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        disabled={disabled}
                        onClick={(e) => {
                            // Prevent the browser from scrolling the focused
                            // button into view when clicked inside a Sheet.
                            // The button still receives focus on real keyboard
                            // tabbing — only mouse-click focus is suppressed.
                            e.currentTarget.blur()
                            onChange(opt.value)
                        }}
                        className={cn(
                            "flex-1 inline-flex items-center justify-center rounded-md font-medium transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                            padding,
                            checked
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {opt.label}
                    </button>
                )
            })}
        </div>
    )
}
