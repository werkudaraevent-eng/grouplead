"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { caretKeepingDigitsAfter, countDigits, formatPhone, formatPhoneWhileTyping, isValidPhone, normalizePhone, phoneDigits } from "@/lib/format/phone"
import { cn } from "@/lib/utils"

/**
 * A phone field that accepts what people type and stores one thing.
 *
 * "0812 3456 7890", "+62812-3456-7890" and "081234567890" all land as
 * "+6281234567890"; the field shows "+62 812-3456-7890". Material's rule
 * for phone fields is exactly this: do not reject a valid number over its
 * punctuation, normalise instead, and tell the person the expected shape
 * through the placeholder rather than a rigid mask.
 *
 * Reformatting on every keystroke replaces the input's value, and a
 * replaced value puts the caret at the end. Editing the middle of a number
 * then meant every digit typed landed at the end. The caret is therefore
 * put back by hand: the digits after it are counted before the format and
 * it is placed in front of the same digits after (counting from the end,
 * because the format rewrites the head, "0812" becoming "+62 812").
 * Backspace over a separator deletes the digit before it, as Google
 * Contacts does, instead of removing the dash only for the format to put
 * it straight back.
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
  const inputRef = useRef<HTMLInputElement>(null)
  const caretRef = useRef<number | null>(null)
  const invalid = text.trim() !== "" && !isValidPhone(text)

  useEffect(() => {
    if (normalizePhone(text) !== value) setText(formatPhone(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // After React has written the formatted text, put the caret where the
  // person left it. Only after our own onChange, never on outside resets.
  useLayoutEffect(() => {
    const caret = caretRef.current
    if (caret === null) return
    caretRef.current = null
    inputRef.current?.setSelectionRange(caret, caret)
  }, [text])

  return (
    <div className={className}>
      {name && <input type="hidden" name={name} value={value} />}
      <Input
        ref={inputRef}
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        value={text}
        placeholder={placeholder}
        required={required}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          let raw = event.target.value
          let caret = event.target.selectionStart ?? raw.length
          const inputType = (event.nativeEvent as InputEvent).inputType

          // Deleting a separator alone changes nothing the format keeps;
          // treat it as deleting the digit on that side of it.
          if (phoneDigits(raw) === phoneDigits(text)) {
            if (inputType === "deleteContentBackward" && caret > 0) {
              raw = raw.slice(0, caret - 1) + raw.slice(caret)
              caret -= 1
            } else if (inputType === "deleteContentForward" && caret < raw.length) {
              raw = raw.slice(0, caret) + raw.slice(caret + 1)
            }
          }

          const next = formatPhoneWhileTyping(raw)
          caretRef.current = caretKeepingDigitsAfter(next, countDigits(raw.slice(caret)))
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
