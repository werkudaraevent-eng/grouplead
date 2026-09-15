"use client"

import { Building2 } from "@/components/icons"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

/**
 * Which business units a person can see. One component for Create User and
 * Edit User, so the two doors behave the same.
 *
 * Material's parent/child checkbox list: the group (HQ) is the parent. Ticking
 * it selects every unit; unticking it clears everything; ticking some units
 * shows the parent as indeterminate. While the group is selected the units
 * show as included and cannot be unticked one by one, because group access is
 * access to all of them by definition, not a list that happens to be full.
 *
 * Rows are 48dp list items with a leading checkbox and no tinted "selected"
 * box: the checkbox is the state, a coloured card would say it twice.
 */

export interface BusinessUnitOption {
  id: string
  name: string
  is_holding: boolean
}

export function BusinessUnitPicker({
  companies,
  value,
  onChange,
  disabled,
}: {
  companies: BusinessUnitOption[]
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const holdings = companies.filter((company) => company.is_holding)
  const units = companies.filter((company) => !company.is_holding)
  const unitIds = units.map((unit) => unit.id)
  const holdingSelected = holdings.some((holding) => value.includes(holding.id))
  const chosenUnits = unitIds.filter((id) => value.includes(id))
  const parentState: boolean | "indeterminate" = holdingSelected ? true : chosenUnits.length > 0 ? "indeterminate" : false

  const toggleHolding = (holdingId: string, checked: boolean) => {
    onChange(checked ? [holdingId, ...unitIds] : [])
  }
  const toggleUnit = (unitId: string, checked: boolean) => {
    onChange(checked ? [...value, unitId] : value.filter((id) => id !== unitId))
  }

  const summary = holdingSelected
    ? "Akses seluruh grup: semua unit bisnis, termasuk yang dibuat nanti."
    : chosenUnits.length === 0
      ? "Belum ada unit yang dipilih. Minimal satu."
      : `${chosenUnits.length} unit dipilih.`

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border bg-card">
        {holdings.length > 0 && (
          <div className="border-b">
            <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Grup (HQ)</p>
            {holdings.map((holding) => (
              <label key={holding.id} className={cn("flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-muted", disabled && "cursor-default opacity-60")}>
                <Checkbox
                  checked={parentState}
                  disabled={disabled}
                  onCheckedChange={(checked) => toggleHolding(holding.id, checked === true)}
                  aria-label={`Semua unit lewat ${holding.name}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{holding.name}</span>
                  <span className="block text-xs text-muted-foreground">Memilih ini berarti akses ke semua unit di bawahnya.</span>
                </span>
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </label>
            ))}
          </div>
        )}
        {units.length > 0 && (
          <div>
            <p className="flex items-center justify-between px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Unit bisnis
              {holdingSelected && <span className="font-normal normal-case tracking-normal">Semua termasuk lewat grup</span>}
            </p>
            <div className="grid sm:grid-cols-2">
              {units.map((unit) => {
                const included = holdingSelected || value.includes(unit.id)
                return (
                  <label key={unit.id} className={cn("flex min-h-12 items-center gap-3 px-4 py-2 text-sm", holdingSelected || disabled ? "cursor-default" : "cursor-pointer hover:bg-muted")}>
                    <Checkbox
                      checked={included}
                      disabled={disabled || holdingSelected}
                      onCheckedChange={(checked) => toggleUnit(unit.id, checked === true)}
                      aria-label={unit.name}
                    />
                    <span className={cn("truncate", holdingSelected ? "text-muted-foreground" : "text-foreground")}>{unit.name}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>
      <p className={cn("text-xs", chosenUnits.length === 0 && !holdingSelected ? "text-[var(--warning-foreground)]" : "text-muted-foreground")}>{summary}</p>
    </div>
  )
}
