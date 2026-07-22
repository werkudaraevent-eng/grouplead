"use client"

import { forwardRef, useCallback, type ChangeEvent } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * A masked currency input that displays formatted thousands separators
 * (Indonesian locale: e.g. 1.500.000.000) while storing the raw integer.
 *
 * Compatible with react-hook-form: accepts value/onChange/onBlur/ref.
 * The `value` prop must be a number | null | undefined.
 * The `onChange` callback receives a synthetic event where the parsed
 * integer is returned, compatible with z.coerce.number().
 */
interface CurrencyInputProps {
    value?: number | string | null
    onChange?: (value: number | null) => void
    onBlur?: () => void
    name?: string
    placeholder?: string
    className?: string
    disabled?: boolean
    /** Prefix shown inside the input display (default: "Rp") */
    prefix?: string
}

const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
    ({ value, onChange, onBlur, name, placeholder = "0", className, disabled, prefix }, ref) => {
        const numericValue = typeof value === "string" ? parseFloat(value) : value

        // Format the display value with Indonesian locale separators
        const displayValue =
            numericValue != null && !isNaN(numericValue) && numericValue !== 0
                ? new Intl.NumberFormat("id-ID").format(numericValue)
                : ""

        const handleChange = useCallback(
            (e: ChangeEvent<HTMLInputElement>) => {
                // Strip all non-numeric characters (periods, commas, spaces, letters)
                const raw = e.target.value.replace(/\D/g, "")
                const parsed = raw ? parseInt(raw, 10) : null
                onChange?.(parsed)
            },
            [onChange]
        )

        return (
            <div className="relative">
                {prefix && displayValue && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">
                        {prefix}
                    </span>
                )}
                <Input
                    ref={ref}
                    type="text"
                    inputMode="numeric"
                    name={name}
                    value={displayValue}
                    onChange={handleChange}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={cn(
                        "h-9 text-sm tabular-nums",
                        prefix && displayValue && "pl-10",
                        className
                    )}
                />
            </div>
        )
    }
)

CurrencyInput.displayName = "CurrencyInput"
export { CurrencyInput }
