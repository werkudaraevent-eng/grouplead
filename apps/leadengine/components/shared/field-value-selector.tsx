"use client"

import { useEffect, useState, type KeyboardEvent } from "react"
import { createClient } from "@/utils/supabase/client"
import { fetchFieldValues, filterFieldValues, type FieldValue } from "@/utils/field-values"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Loader2, X, ChevronsUpDown } from "lucide-react"

interface FieldValueSelectorProps {
  fieldKey: string
  companyId: string
  selectedValues: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  allowCustom?: boolean
  /** Values already used in other mappings — shown with a "used" indicator */
  usedValues?: Set<string>
}

export function FieldValueSelector({
  fieldKey,
  companyId,
  selectedValues,
  onChange,
  placeholder = "Select values…",
  allowCustom = false,
  usedValues,
}: FieldValueSelectorProps) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [values, setValues] = useState<FieldValue[]>([])
  const [search, setSearch] = useState("")
  const [customInput, setCustomInput] = useState("")

  useEffect(() => {
    if (!fieldKey || !companyId) return
    setLoading(true)
    fetchFieldValues(supabase, fieldKey, companyId)
      .then(setValues)
      .finally(() => setLoading(false))
  }, [fieldKey, companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = filterFieldValues(values, search)

  const toggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value))
    } else {
      onChange([...selectedValues, value])
    }
  }

  const removeTag = (value: string) => {
    onChange(selectedValues.filter((v) => v !== value))
  }

  const addCustom = (val: string) => {
    const trimmed = val.trim()
    if (trimmed && !selectedValues.includes(trimmed)) {
      onChange([...selectedValues, trimmed])
    }
    setCustomInput("")
  }

  const handleCustomKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addCustom(customInput)
    }
  }

  // Resolve label for a selected value
  const getLabel = (val: string) => {
    const found = values.find((v) => v.value === val)
    return found?.label ?? val
  }

  const showFreeText = allowCustom && values.length === 0 && !loading

  return (
    <div className="space-y-2">
      {/* Selected tags */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedValues.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-md bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-medium"
            >
              {getLabel(v)}
              <button
                type="button"
                onClick={() => removeTag(v)}
                className="hover:text-blue-900"
                aria-label={`Remove ${getLabel(v)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {showFreeText ? (
        /* Fallback free-text input when no values available */
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">No values available. Type custom values below.</p>
          <div className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 min-h-[36px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={handleCustomKeyDown}
              onBlur={() => { if (customInput.trim()) addCustom(customInput) }}
              placeholder="Type and press Enter"
              className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      ) : (
        /* Popover multi-select */
        <Popover open={open} onOpenChange={setOpen} modal={false}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between h-9 text-xs font-normal"
            >
              <span className="truncate text-muted-foreground">
                {selectedValues.length > 0
                  ? `${selectedValues.length} selected`
                  : placeholder}
              </span>
              <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onWheel={(e) => e.stopPropagation()}
          >
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search…"
                  value={search}
                  onValueChange={setSearch}
                />
                <CommandList className="max-h-[280px] overflow-y-auto">
                  <CommandEmpty>No values found.</CommandEmpty>
                  <CommandGroup>
                    {filtered.map((fv) => {
                      const checked = selectedValues.includes(fv.value)
                      const isUsed = usedValues?.has(fv.value) && !checked
                      return (
                        <CommandItem
                          key={fv.id}
                          value={fv.value}
                          onSelect={() => toggle(fv.value)}
                          className={isUsed ? "opacity-50" : ""}
                        >
                          <Checkbox
                            checked={checked}
                            className="mr-2 pointer-events-none"
                            tabIndex={-1}
                          />
                          <span className="text-xs flex-1">{fv.label}</span>
                          {isUsed && (
                            <span className="text-[10px] text-amber-600 font-medium ml-1 shrink-0">
                              used
                            </span>
                          )}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
                {allowCustom && (
                  <div className="border-t px-2 py-1.5">
                    <input
                      type="text"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      onKeyDown={handleCustomKeyDown}
                      placeholder="Add custom value…"
                      className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                )}
              </Command>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
