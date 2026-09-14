"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { formatPhone, formatPhoneWhileTyping, isValidPhone, normalizePhone } from "@/lib/format/phone"
import { cn } from "@/lib/utils"

/**
 * A phone field that accepts what people type and stores one thing.
 *
 * "0812 3456 7890", "+62812-3456-7890" and "081234567890" all land as
 * "+6281234567890"; the field shows "+62 812-3456-7890". Material's rule
 * for phone fields is exactly this: do not reject a valid number over its
 * punctuation, normalise instead, and tell the person the expected shape
 * through the placeholder rather than a rigid mask.
 */
export function PhoneInput({
  value,
  onChange,
  className,
  inputClassName,
  id,
  name,
  placeholder = "0812 3456 7890",
  required,
  autoComplete = "tel",
}: {
  /** The stored, normalised number. */
  value: string
  onChange: (next: string) => void
  className?: string
  inputClassName?: string
  id?: string
  /** When set, a hidden input submits the normalised number under this name. */
  name?: string
  placeholder?: string
  required?: boolean
  autoComplete?: string
}) {
  const [text, setText] = useState(() => formatPhone(value))
  const invalid = text.trim() !== "" && !isValidPhone(text)

  useEffect(() => {
    if (normalizePhone(text) !== value) setText(formatPhone(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className={className}>
      {name && <input type="hidden" name={name} value={value} />}
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        value={text}
        placeholder={placeholder}
        required={required}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          const next = formatPhoneWhileTyping(event.target.value)
          setText(next)
          onChange(normalizePhone(next))
        }}
        onBlur={() => setText(formatPhone(value))}
        className={cn("h-12 tabular-nums", inputClassName, invalid && "border-[var(--danger-foreground)] focus-visible:border-[var(--danger-foreground)]")}
      />
      {invalid && <p className="mt-1 text-xs text-[var(--danger-foreground)]">Nomor terlalu pendek atau terlalu panjang.</p>}
    </div>
  )
}
