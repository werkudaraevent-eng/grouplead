"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { formatNumber, formatNumberWhileTyping, parseNumber } from "@/lib/format/number"
import { cn } from "@/lib/utils"

/**
 * A number field that reads like a number.
 *
 * Material's text field for an amount: a prefix for the unit ("Rp"), the
 * numeric keyboard, and formatting as the person types, which Material
 * allows when the result is unambiguous, as thousands separators are. The
 * value handed back is a plain number; the dots are display only.
 */
export function NumberInput({
  value,
  onChange,
  prefix,
  suffix,
  decimals = 0,
  className,
  inputClassName,
  id,
  name,
  placeholder,
  required,
  disabled,
  "aria-label": ariaLabel,
}: {
  value: number | null
  onChange: (next: number | null) => void
  prefix?: string
  suffix?: string
  /** Decimal places accepted; 0 for whole numbers such as rupiah. */
  decimals?: number
  className?: string
  inputClassName?: string
  id?: string
  /** When set, a hidden input submits the plain number under this name. */
  name?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  "aria-label"?: string
}) {
  const [text, setText] = useState(() => formatNumber(value, decimals))

  // Keep the display in step with a value changed from outside (a reset, a
  // loaded draft) without fighting the person mid-keystroke.
  useEffect(() => {
    const shown = parseNumber(text, decimals)
    if (shown !== value) setText(formatNumber(value, decimals))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className={cn("relative", className)}>
      {name && <input type="hidden" name={name} value={value === null ? "" : String(value)} />}
      {prefix && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">{prefix}</span>
      )}
      <Input
        id={id}
        type="text"
        inputMode={decimals > 0 ? "decimal" : "numeric"}
        autoComplete="off"
        value={text}
        placeholder={placeholder ?? "0"}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => {
          const next = formatNumberWhileTyping(event.target.value, decimals)
          setText(next)
          onChange(parseNumber(next, decimals))
        }}
        onBlur={() => setText(formatNumber(value, decimals))}
        className={cn("h-12 text-right tabular-nums", prefix && "pl-10", suffix && "pr-12", inputClassName)}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{suffix}</span>
      )}
    </div>
  )
}
