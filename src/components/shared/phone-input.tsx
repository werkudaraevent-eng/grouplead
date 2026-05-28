"use client"

/**
 * Phone input with country selector.
 *
 * Visual:
 *   ┌──────────┬────────────────────────────────┐
 *   │ 🇮🇩 +62 ▾ │ 8112836676                     │
 *   └──────────┴────────────────────────────────┘
 *
 * Behaviour:
 *   • Country selector = searchable popover (PHONE_COUNTRIES list).
 *   • Default country = `ID`. Auto-detected from existing E.164 value
 *     when prefilled.
 *   • As the user types, value is held as the *national* part. On blur
 *     the full E.164 is composed (`+{dialCode}{digits}`) and run through
 *     `libphonenumber-js` for validation.
 *   • Returns canonical E.164 via `onChange` so the DB always sees the
 *     same shape we store everywhere else.
 *   • Empty national part → empty string returned (caller decides null
 *     vs "").
 */

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import type { CountryCode } from "libphonenumber-js"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import {
    normalizePhoneToE164,
    phoneFormatStatus,
    DEFAULT_PHONE_COUNTRY,
} from "@/lib/phone-normalize"
import {
    PHONE_COUNTRIES,
    getCountryByCode,
    detectCountryFromE164,
    type PhoneCountry,
} from "@/lib/phone-countries"

interface PhoneInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onBlur"> {
    value: string | null | undefined
    onChange: (value: string) => void
    onBlur?: () => void
    /** ISO country code used when the user types bare digits. Default ID. */
    defaultCountry?: CountryCode
    /** Optional className for the wrapping element. */
    wrapperClassName?: string
    /** Hide the inline warning (e.g. when used inside a list cell). */
    hideWarning?: boolean
}

/**
 * Strip the dial-code prefix from an E.164 string if it matches the
 * given country. Returns the national-part digits.
 */
function stripDialCode(value: string, country: PhoneCountry | undefined): string {
    if (!country || !value) return value
    const v = value.startsWith("+") ? value.slice(1) : value
    if (v.startsWith(country.dialCode)) return v.slice(country.dialCode.length)
    return v
}

export function PhoneInput({
    value,
    onChange,
    onBlur,
    defaultCountry = DEFAULT_PHONE_COUNTRY,
    placeholder = "8123456789",
    className,
    wrapperClassName,
    hideWarning,
    ...rest
}: PhoneInputProps) {
    const [country, setCountry] = React.useState<CountryCode>(() => {
        const detected = value ? detectCountryFromE164(value) : undefined
        return detected?.code ?? defaultCountry
    })

    const [national, setNational] = React.useState<string>(() => {
        if (!value) return ""
        const detected = detectCountryFromE164(value)
        if (detected) return stripDialCode(value, detected)
        return value.replace(/^\+/, "")
    })

    // Re-sync when the form resets / hydrates.
    const lastSyncedValueRef = React.useRef<string | null | undefined>(value)
    React.useEffect(() => {
        if (value === lastSyncedValueRef.current) return
        lastSyncedValueRef.current = value
        if (!value) {
            setNational("")
            return
        }
        const detected = detectCountryFromE164(value)
        if (detected) {
            setCountry(detected.code)
            setNational(stripDialCode(value, detected))
        } else {
            setNational(value.replace(/^\+/, ""))
        }
    }, [value])

    const selectedCountry =
        getCountryByCode(country) ?? getCountryByCode(defaultCountry)!

    const propagate = React.useCallback(
        (newCountry: CountryCode, newNational: string) => {
            const trimmed = newNational.trim()
            if (!trimmed) {
                onChange("")
                return
            }
            const dial = getCountryByCode(newCountry)?.dialCode ?? ""
            const composed = `+${dial}${trimmed.replace(/[^\d]/g, "")}`
            const canonical = normalizePhoneToE164(composed, newCountry)
            onChange(canonical ?? composed)
        },
        [onChange],
    )

    const handleBlur = () => {
        propagate(country, national)
        onBlur?.()
    }

    const handleCountryChange = (next: CountryCode) => {
        setCountry(next)
        propagate(next, national)
    }

    // Warning is computed against the would-be canonical form.
    const composed = national.trim()
        ? `+${selectedCountry.dialCode}${national.trim().replace(/[^\d]/g, "")}`
        : ""
    const status = phoneFormatStatus(composed, country)
    const showWarn = !hideWarning && status === "invalid"

    return (
        <div className={cn("space-y-1", wrapperClassName)}>
            <div
                className={cn(
                    "flex items-stretch rounded-md border border-input bg-background overflow-hidden",
                    "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30",
                    "transition-shadow",
                    showWarn &&
                        "border-amber-400 focus-within:border-amber-400 focus-within:ring-amber-200",
                )}
            >
                <CountryPicker
                    selected={selectedCountry}
                    onSelect={handleCountryChange}
                />
                <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder={placeholder}
                    value={national}
                    onChange={(e) => setNational(e.target.value)}
                    onBlur={handleBlur}
                    className={cn(
                        "border-0 rounded-none focus-visible:ring-0 focus-visible:border-0 h-9 px-2.5 text-sm flex-1 min-w-0",
                        className,
                    )}
                    {...rest}
                />
            </div>
            {showWarn && (
                <p className="text-[11px] text-amber-600">
                    Number doesn’t look valid for {selectedCountry.name}. Will save as-is.
                </p>
            )}
        </div>
    )
}

function CountryPicker({
    selected,
    onSelect,
}: {
    selected: PhoneCountry
    onSelect: (code: CountryCode) => void
}) {
    const [open, setOpen] = React.useState(false)
    return (
        <Popover open={open} onOpenChange={setOpen} modal>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={`Country: ${selected.name}`}
                    className="h-9 px-2.5 rounded-none rounded-l-md border-r border-input gap-1.5 font-normal text-sm hover:bg-muted/60 shrink-0"
                >
                    <span className="text-base leading-none" aria-hidden>
                        {selected.flag}
                    </span>
                    <span className="text-muted-foreground">+{selected.dialCode}</span>
                    <ChevronsUpDown className="h-3 w-3 opacity-50 ml-0.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[280px]" align="start">
                <Command>
                    <CommandInput placeholder="Search country…" />
                    <CommandList className="max-h-[260px]">
                        <CommandEmpty>No country found</CommandEmpty>
                        <CommandGroup>
                            {PHONE_COUNTRIES.map((c) => (
                                <CommandItem
                                    key={c.code}
                                    value={`${c.name} +${c.dialCode} ${c.code}`}
                                    onSelect={() => {
                                        onSelect(c.code)
                                        setOpen(false)
                                    }}
                                >
                                    <span className="text-base leading-none mr-2" aria-hidden>
                                        {c.flag}
                                    </span>
                                    <span className="flex-1 truncate">{c.name}</span>
                                    <span className="text-xs text-muted-foreground mr-2">
                                        +{c.dialCode}
                                    </span>
                                    <Check
                                        className={cn(
                                            "h-4 w-4",
                                            selected.code === c.code ? "opacity-100" : "opacity-0",
                                        )}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
