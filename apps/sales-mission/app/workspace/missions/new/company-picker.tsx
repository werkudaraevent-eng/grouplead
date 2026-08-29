"use client"

import { useEffect, useRef, useState } from "react"
import { Building2, Check, Loader2, X } from "lucide-react"
import { searchCompanies, type CompanySuggestion } from "@/app/actions/company-search-actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * Client company picker with live search against LeadEngine.
 *
 * Picking a match records the CRM's id alongside the name. That id is what
 * later lets the lead-push modal warn about the account's current owner and its
 * open leads — a typed-in name alone leaves both guards blind.
 *
 * Typing a name that has no match is still allowed. Blocking it would stop a
 * rep scheduling a visit to a company the CRM has never heard of, which is
 * exactly the sort of visit worth making.
 */
export function CompanyPicker() {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<CompanySuggestion | null>(null)
  const [results, setResults] = useState<CompanySuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setResults([])
      return
    }

    // Debounced: a field connection should not fire a request per keystroke.
    const timer = setTimeout(async () => {
      setSearching(true)
      const result = await searchCompanies(query)
      setResults(result.companies)
      setError(result.error)
      setSearching(false)
      setOpen(true)
    }, 350)

    return () => clearTimeout(timer)
  }, [query, selected])

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [])

  const clear = () => {
    setSelected(null)
    setQuery("")
    setResults([])
  }

  return (
    <div className="space-y-1.5 sm:col-span-2" ref={containerRef}>
      <Label htmlFor="clientCompanyName">Client company</Label>

      {/* The name always submits; the id only when a match was chosen. */}
      <input type="hidden" name="clientCompanyId" value={selected?.id ?? ""} />

      <div className="relative">
        <Input
          id="clientCompanyName"
          name="clientCompanyName"
          required
          maxLength={200}
          autoComplete="off"
          placeholder="Ketik minimal 2 huruf untuk mencari…"
          value={selected?.name ?? query}
          readOnly={Boolean(selected)}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          className="h-11 pr-10"
        />

        <span className="absolute right-2 top-1/2 -translate-y-1/2">
          {selected ? (
            <button
              type="button"
              onClick={clear}
              aria-label="Ganti perusahaan"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : searching ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}
        </span>

        {open && !selected && (results.length > 0 || error) && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
            {error ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">{error}</p>
            ) : (
              results.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => { setSelected(company); setOpen(false) }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted"
                >
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{company.name}</span>
                    {company.industry && (
                      <span className="block truncate text-xs text-muted-foreground">{company.industry}</span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {selected ? (
        <p className="flex items-center gap-1.5 text-xs text-[var(--success-foreground)]">
          <Check className="h-3.5 w-3.5" /> Tertaut ke perusahaan di LeadEngine
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Belum tertaut. Nama tetap tersimpan, dan admin CRM menautkannya nanti.
        </p>
      )}
    </div>
  )
}
