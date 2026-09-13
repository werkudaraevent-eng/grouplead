"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, MapPin } from "lucide-react"
import { searchLocations, type LocationSuggestion } from "@/app/actions/location-search-actions"
import { Input } from "@/components/ui/input"

/**
 * Location field with suggestions from the same provider LeadEngine uses for
 * Event City, so "Jakarta Selatan" is spelled one way across both apps.
 *
 * Deliberately a suggestion, not a constraint: the typed value is what submits
 * whether or not it was picked from the list. A rep visiting a client in a
 * kawasan the provider has never heard of still has to be able to write it
 * down, and location is an optional field anyway.
 */
export function LocationPicker({
  id,
  required,
  placeholder,
  onChange,
  initial,
}: {
  id: string
  required: boolean
  placeholder: string
  initial?: string
  /** Lifted so the schedule picker can waive the travel buffer for a same-building visit. */
  onChange?: (value: string) => void
}) {
  const [query, setQuery] = useState(initial ?? "")
  const [results, setResults] = useState<LocationSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  /** Suppresses the lookup that a pick, or an initial value, would otherwise trigger. */
  const justPicked = useRef(Boolean(initial))
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false
      return
    }

    if (query.trim().length < 2) {
      setResults([])
      setError(null)
      return
    }

    // Debounced: a field connection should not fire a request per keystroke.
    const timer = setTimeout(async () => {
      setSearching(true)
      const result = await searchLocations(query)
      setResults(result.locations)
      setError(result.error)
      setSearching(false)
      setOpen(true)
    }, 350)

    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      <Input
        id={id}
        name="location"
        maxLength={300}
        required={required}
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        onChange={(event) => { setQuery(event.target.value); onChange?.(event.target.value) }}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        className="h-12 pr-10"
      />

      {searching && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}

      {open && (results.length > 0 || error) && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
          {error ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">{error}</p>
          ) : (
            results.map((location) => (
              <button
                key={`${location.value}-${location.country ?? ""}`}
                type="button"
                onClick={() => {
                  justPicked.current = true
                  setQuery(location.value)
                  onChange?.(location.value)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted"
              >
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{location.value}</span>
                  {location.country && (
                    <span className="block truncate text-xs text-muted-foreground">{location.country}</span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
