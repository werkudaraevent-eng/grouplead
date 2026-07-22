"use client"

/**
 * Standard form field label.
 *
 * Replaces the ad-hoc pattern across modals where required-asterisk was
 * concatenated into the label string and labels were styled ALL CAPS.
 *
 * Modern conventions (Linear, Notion, Vercel, Attio, Stripe):
 *   • Sentence-case, medium weight, comfortable readable size.
 *   • Required marker is a real visual element (red), aria-hidden so
 *     screen readers don't read "Star" — paired with `aria-required` on
 *     the input itself.
 *   • Optional helper / tooltip slot for explaining ambiguous fields.
 */

import * as React from "react"
import { Info } from "lucide-react"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface FormFieldLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
    children: React.ReactNode
    required?: boolean
    /** Optional inline tooltip text. Shows an info icon next to the label. */
    hint?: string
}

export function FormFieldLabel({
    children,
    required,
    hint,
    className,
    ...rest
}: FormFieldLabelProps) {
    return (
        <label
            className={cn(
                "inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground/85 leading-none",
                className,
            )}
            {...rest}
        >
            <span>{children}</span>
            {required && (
                <span className="text-destructive" aria-hidden="true">
                    *
                </span>
            )}
            {hint && (
                <Tooltip content={hint}>
                    <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                </Tooltip>
            )}
        </label>
    )
}
