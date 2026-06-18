"use client"

/**
 * City autocomplete — combines locally cached `master_options` (event_city)
 * with live GeoNames search so the list is always up to date.
 *
 * Behaviour:
 *   • Empty / short query → shows cached DB cities (instant, offline-safe).
 *   • Typing ≥2 chars     → debounced fetch to /api/cities/search, merged
 *                            with cached matches (cached shown first).
 *   • On select of a brand-new city → fire-and-forget upsert into
 *                            master_options so it's cached for next time.
 *
 * The stored value is the plain city name string (matches the lead's
 * destinations[].city shape and keeps analytics grouping stable).
 */

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { upsertEventCityAction } from "@/app/actions/city-actions"
import type { CitySuggestion } from "@/app/api/cities/search/route"

interface CachedCity {
    value: string
    label: string
}

interface CityAutocompleteProps {
    value: string | null
    onChange: (value: string | null) => void
    /** Cached cities from master_options (event_city). */
    cachedOptions: CachedCity[]
    /** Optional ISO-2 country bias (e.g. "ID"). */
    countryBias?: string
    placeholder?: string
    disabled?: boolean
    className?: string
}

const DEBOUNCE_MS = 300
const MIN_QUERY = 2

export function CityAutocomplete({
    value,
    onChange,
    cachedOptions,
    countryBias,
    placeholder = "Search city…",
    disabled,
    className,
}: CityAutocompleteProps) {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [remote, setRemote] = React.useState<CitySuggestion[]>([])
    const [loading, setLoading] = React.useState(false)
    const abortRef = React.useRef<AbortController | null>(null)

    // Debounced remote search.
    React.useEffect(() => {
        const q = query.trim()
        if (q.length < MIN_QUERY) {
            setRemote([])
            setLoading(false)
            abortRef.current?.abort()
            return
        }
        setLoading(true)
        const handle = setTimeout(async () => {
            abortRef.current?.abort()
            const controller = new AbortController()
            abortRef.current = controller
            try {
                const params = new URLSearchParams({ q })
                if (countryBias) params.set("country", countryBias)
                const res = await fetch(`/api/cities/search?${params}`, {
                    signal: controller.signal,
                })
                const data = (await res.json()) as { cities?: CitySuggestion[] }
                setRemote(data.cities ?? [])
            } catch {
                // Aborted or network error — keep cached results only.
            } finally {
                setLoading(false)
            }
        }, DEBOUNCE_MS)
        return () => clearTimeout(handle)
    }, [query, countryBias])

    const selectedLabel = value ?? null

    // Merge: cached matches first (deduped), then remote-only suggestions.
    const merged = React.useMemo(() => {
        const q = query.trim().toLowerCase()
        const cachedMatches = cachedOptions.filter((c) =>
            q ? c.label.toLowerCase().includes(q) : true,
        )
        const cachedKeys = new Set(cachedMatches.map((c) => c.value.toLowerCase()))
        const remoteOnly = remote
            .filter((r) => !cachedKeys.has(r.value.toLowerCase()))
            .map((r) => ({
                value: r.value,
                label: r.label,
                secondary: r.country ?? undefined,
                country: r.country,
            }))
        // Sort saved cities alphabetically so newly cached cities slot into
        // place instead of piling up at the bottom by insertion order.
        const cachedShaped = cachedMatches
            .map((c) => ({
                value: c.value,
                label: c.label,
                secondary: undefined as string | undefined,
                country: null as string | null,
            }))
            .sort((a, b) => a.label.localeCompare(b.label))
        return { cachedShaped, remoteOnly }
    }, [cachedOptions, remote, query])

    const handleSelect = (
        city: { value: string; country?: string | null },
        isCached: boolean,
    ) => {
        onChange(city.value)
        setOpen(false)
        setQuery("")
        // Auto-cache brand-new cities (fire-and-forget; failure is non-fatal).
        if (!isCached) {
            void upsertEventCityAction(city.value, city.country ?? null)
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen} modal>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "w-full min-w-0 justify-between font-normal h-9 px-3 text-sm",
                        !selectedLabel && "text-muted-foreground",
                        className,
                    )}
                >
                    <span className="truncate flex-1 min-w-0 text-left">
                        {selectedLabel ?? placeholder}
                    </span>
                    <span className="flex items-center gap-1 ml-2 shrink-0">
                        {selectedLabel && !disabled && (
                            <span
                                role="button"
                                tabIndex={-1}
                                onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    onChange(null)
                                }}
                                className="inline-flex items-center justify-center rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                aria-label="Clear selection"
                            >
                                <X className="h-3.5 w-3.5" />
                            </span>
                        )}
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="p-0 w-[--radix-popover-trigger-width]"
                align="start"
            >
                {/* shouldFilter=false → we filter cached + drive remote ourselves. */}
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Type a city name…"
                        value={query}
                        onValueChange={setQuery}
                    />
                    <CommandList className="max-h-[280px]">
                        {loading && (
                            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Searching…
                            </div>
                        )}
                        {!loading &&
                            merged.cachedShaped.length === 0 &&
                            merged.remoteOnly.length === 0 && (
                                <CommandEmpty>
                                    {query.trim().length < MIN_QUERY
                                        ? "Type at least 2 characters"
                                        : "No cities found"}
                                </CommandEmpty>
                            )}
                        {merged.cachedShaped.length > 0 && (
                            <CommandGroup heading="Saved cities">
                                {merged.cachedShaped.map((opt) => (
                                    <CommandItem
                                        key={`cached-${opt.value}`}
                                        value={opt.value}
                                        onSelect={() => handleSelect(opt, true)}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === opt.value ? "opacity-100" : "opacity-0",
                                            )}
                                        />
                                        <span className="truncate flex-1">{opt.label}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                        {merged.remoteOnly.length > 0 && (
                            <CommandGroup heading="From GeoNames">
                                {merged.remoteOnly.map((opt) => (
                                    <CommandItem
                                        key={`remote-${opt.value}-${opt.secondary ?? ""}`}
                                        value={`${opt.value} ${opt.secondary ?? ""}`}
                                        onSelect={() => handleSelect(opt, false)}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === opt.value ? "opacity-100" : "opacity-0",
                                            )}
                                        />
                                        <span className="truncate flex-1">{opt.label}</span>
                                        {opt.secondary && (
                                            <span className="ml-2 text-xs text-muted-foreground shrink-0">
                                                {opt.secondary}
                                            </span>
                                        )}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
