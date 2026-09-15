"use client"

import { useEffect, useRef, useState } from "react"
import { Building2, Check, History, Loader2, UserSearch, X } from "@/components/icons"
import { searchCompanies, type CompanySuggestion, type ProspectSuggestion } from "@/app/actions/company-search-actions"
import { Input } from "@/components/ui/input"

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
export function CompanyPicker({
  label,
  required = true,
  onLink,
  onPickProspect,
  initial,
}: {
  /** Only used for the clear button's accessible name; the visible label and
      the required marker belong to the FieldShell that wraps this. */
  label: string
  required?: boolean
  /** Lifts the CRM link so the contact field can offer that company's people. */
  onLink?: (clientCompanyId: string | null) => void
  /** A prospect was chosen: the form fills its contact and address and links the mission to it. */
  onPickProspect?: (prospect: ProspectSuggestion | null) => void
  /** A company carried over from another mission. With an id it starts linked. */
  initial?: { name: string; id: string | null }
}) {
  const [query, setQuery] = useState(initial?.id ? "" : (initial?.name ?? ""))
  const [selected, setSelected] = useState<CompanySuggestion | null>(
    initial?.id ? { id: initial.id, name: initial.name, industry: null } : null
  )
  const [results, setResults] = useState<CompanySuggestion[]>([])
  const [previousNames, setPreviousNames] = useState<string[]>([])
  const [prospects, setProspects] = useState<ProspectSuggestion[]>([])
  const [pickedProspect, setPickedProspect] = useState<ProspectSuggestion | null>(null)
  const [searching, setSearching] = useState(false)
  /** Suppresses the lookup that adopting a previous name would otherwise trigger. */
  const justAdopted = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (justAdopted.current) {
      justAdopted.current = false
      return
    }
    if (selected || pickedProspect || query.trim().length < 2) {
      setResults([])
      setPreviousNames([])
      setProspects([])
      return
    }

    // Debounced: a field connection should not fire a request per keystroke.
    const timer = setTimeout(async () => {
      setSearching(true)
      const result = await searchCompanies(query)
      setResults(result.companies)
      setProspects(result.prospects)
      setPreviousNames(result.previousNames)
      setError(result.error)
      setSearching(false)
      setOpen(true)
    }, 350)

    return () => clearTimeout(timer)
  }, [query, selected, pickedProspect])

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [])

  const clear = () => {
    setSelected(null)
    setPickedProspect(null)
    setQuery("")
    setResults([])
    setPreviousNames([])
    setProspects([])
    onLink?.(null)
    onPickProspect?.(null)
  }

  const pickProspect = (prospect: ProspectSuggestion) => {
    setPickedProspect(prospect)
    setQuery(prospect.name)
    setSelected(prospect.clientCompanyId ? { id: prospect.clientCompanyId, name: prospect.name, industry: null } : null)
    setResults([])
    setPreviousNames([])
    setProspects([])
    setOpen(false)
    onLink?.(prospect.clientCompanyId)
    onPickProspect?.(prospect)
  }

  const hasDropdown = results.length > 0 || prospects.length > 0 || previousNames.length > 0 || Boolean(error)

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {/* The name always submits; the id only when a match was chosen. */}
      <input type="hidden" name="clientCompanyId" value={selected?.id ?? ""} />

      <div className="relative">
        <Input
          id="field-client_company"
          name="clientCompanyName"
          required={required}
          maxLength={200}
          autoComplete="off"
          placeholder="Ketik minimal 2 huruf untuk mencari…"
          value={selected?.name ?? query}
          readOnly={Boolean(selected) || Boolean(pickedProspect)}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => { if (hasDropdown) setOpen(true) }}
          className="h-12 pr-10"
        />

        <span className="absolute right-2 top-1/2 -translate-y-1/2">
          {selected || pickedProspect ? (
            <button
              type="button"
              onClick={clear}
              aria-label={`Ganti ${label}`}
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : searching ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}
        </span>

        {open && !selected && !pickedProspect && hasDropdown && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
            {error && <p className="px-3 py-3 text-xs text-muted-foreground">{error}</p>}

            {/* Open prospects first: a visit to one of them is what this
                form is most often for, and picking it carries the contact
                over and marks the prospect Confirmed on save. */}
            {prospects.length > 0 && onPickProspect && (
              <div>
                <p className="px-3 pb-1 pt-2.5 text-[11px] font-semibold text-muted-foreground">Prospek</p>
                {prospects.map((prospect) => (
                  <button
                    key={prospect.id}
                    type="button"
                    onClick={() => pickProspect(prospect)}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted"
                  >
                    <UserSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{prospect.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[prospect.contactName, prospect.statusLabel, prospect.ownerName ? `pemegang ${prospect.ownerName}` : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {results.length > 0 && prospects.length > 0 && onPickProspect && (
              <p className="border-t px-3 pb-1 pt-2.5 text-[11px] font-semibold text-muted-foreground">LeadEngine</p>
            )}
            {results.map((company) => (
              <button
                key={company.id}
                type="button"
                onClick={() => { setSelected(company); setOpen(false); onLink?.(company.id) }}
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
            ))}

            {/*
              Names from earlier missions that the CRM has not seen yet. Picking
              one adopts the spelling only; there is no id to link, and the
              company reaches the CRM once a visit report is submitted. This is
              what stops two reps producing "PT Arunika" and "Arunika Kreasi"
              for one client a week apart.
            */}
            {previousNames.length > 0 && (
              <div className={results.length > 0 ? "border-t" : undefined}>
                <p className="px-3 pb-1 pt-2.5 text-[11px] font-semibold text-muted-foreground">
                  Dari mission sebelumnya, belum ada di CRM
                </p>
                {previousNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      justAdopted.current = true
                      setQuery(name)
                      setResults([])
                      setPreviousNames([])
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted"
                  >
                    <History className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {pickedProspect ? (
        <p className="flex items-center gap-1.5 text-xs text-[var(--success-foreground)]">
          <Check className="h-3.5 w-3.5" /> Dari prospek{pickedProspect.ownerName ? ` (pemegang ${pickedProspect.ownerName})` : ""}. Prospek menjadi Confirmed saat mission disimpan.
        </p>
      ) : selected ? (
        <p className="flex items-center gap-1.5 text-xs text-[var(--success-foreground)]">
          <Check className="h-3.5 w-3.5" /> Tertaut ke perusahaan di LeadEngine
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Belum ada di CRM. Mission tetap bisa dibuat. Perusahaan masuk ke LeadEngine setelah
          laporan kunjungan disubmit, ditandai agar admin CRM melengkapinya.
        </p>
      )}
    </div>
  )
}
