"use client"

import { useMasterOptions } from "@/hooks/use-master-options"
import { useCascadeRelations } from "@/hooks/use-cascade-relations"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import type { FormSchema } from "@/types"

export function DynamicField({ schema, value, onChange, companyId, allValues, isRequired }: {
    schema: FormSchema; value: unknown; onChange: (val: unknown) => void; companyId?: string; allValues: Record<string, unknown>; isRequired?: boolean;
}) {
    const { options } = useMasterOptions(
        schema.field_type === "dropdown" ? (schema.options_category ?? undefined) : undefined, companyId
    )
    const cascadeRelations = useCascadeRelations()

    // Determine parent: explicit parent_dependency OR auto-detected from cascade_relations
    const explicitParent = schema.parent_dependency
    const autoCascadeParent = !explicitParent && schema.options_category
        ? cascadeRelations[schema.options_category] ?? null
        : null
    const autoCascadeParentFieldKey = autoCascadeParent
        ? autoCascadeParent.replace(/^custom_[a-z]+__/, "")
        : null

    const parentFieldKey = explicitParent ?? autoCascadeParentFieldKey
    const parentVal = parentFieldKey ? (allValues[parentFieldKey] as string | null) : null
    const isDisabledByParent = !!parentFieldKey && !parentVal
    const filteredOptions = parentFieldKey
        ? (parentVal ? options.filter((o) => o.parent_value === parentVal) : [])
        : options
    const label = `${schema.field_name}${isRequired ? " *" : ""}`
    
    if (schema.field_type === "dropdown") {
        return (
            <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
                <Select value={(value as string) || undefined} onValueChange={(v) => onChange(v || null)} disabled={isDisabledByParent}>
                    <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder={`Select ${schema.field_name.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                        {filteredOptions.length === 0 ? (
                            <SelectItem value="__empty" disabled>{isDisabledByParent ? "Select parent field first" : "No options configured in Settings"}</SelectItem>
                        ) : (
                            filteredOptions.map((opt, index) => (<SelectItem key={`opt-${index}-${opt.value}`} value={opt.value}>{opt.label}</SelectItem>))
                        )}
                    </SelectContent>
                </Select>
            </div>
        )
    }
    
    const inputType = schema.field_type === "number" ? "number" : schema.field_type === "date" ? "date" : "text"
    return (
        <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
            <Input type={inputType} className="h-9 text-sm" value={(value as string) ?? ""} disabled={isDisabledByParent}
                onChange={(e) => {
                    const v = e.target.value
                    onChange(schema.field_type === "number" ? (v === "" ? null : Number(v)) : v || null)
                }} />
        </div>
    )
}
