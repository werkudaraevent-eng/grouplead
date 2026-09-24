"use client"

import { useId } from "react"
import { useMasterOptions } from "@/hooks/use-master-options"
import { useCascadeRelations } from "@/hooks/use-cascade-relations"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { FormFieldLabel } from "@/components/shared/form-field-label"
import { sentenceCaseLabel } from "@/lib/label-case"
import type { FormSchema } from "@/types"

/**
 * A tenant's custom field (Settings → Layout) in a record's form: company,
 * contact and lead. Its label is the same `FormFieldLabel` every built-in
 * field has (13px, medium, sentence case, the required mark as a red *),
 * with the same 14px to its control as a native field's `FormItem`; it used
 * to be 12px tracked capitals ("SEGMENT TIER *") beside sentence-case
 * native labels ("Segment tier *" is what it now reads). The admin's name
 * is shown in sentence case (`sentenceCaseLabel`), as the built-in ones are
 * written.
 */
export function DynamicField({ schema, value, onChange, companyId, allValues, isRequired }: {
    schema: FormSchema; value: unknown; onChange: (val: unknown) => void; companyId?: string; allValues: Record<string, unknown>; isRequired?: boolean;
}) {
    const { options } = useMasterOptions(
        schema.field_type === "dropdown" ? (schema.options_category ?? undefined) : undefined, companyId
    )
    const cascadeRelations = useCascadeRelations()
    const id = useId()

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
    const label = sentenceCaseLabel(schema.field_name)
    
    if (schema.field_type === "dropdown") {
        return (
            <div className="grid gap-2 space-y-1.5">
                <FormFieldLabel htmlFor={id} required={isRequired}>{label}</FormFieldLabel>
                <Select value={(value as string) || undefined} onValueChange={(v) => onChange(v || null)} disabled={isDisabledByParent}>
                    <SelectTrigger id={id} aria-required={isRequired || undefined} className="h-9 text-sm">
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
        <div className="grid gap-2 space-y-1.5">
            <FormFieldLabel htmlFor={id} required={isRequired}>{label}</FormFieldLabel>
            <Input id={id} aria-required={isRequired || undefined} type={inputType} className="h-9 text-sm" value={(value as string) ?? ""} disabled={isDisabledByParent}
                onChange={(e) => {
                    const v = e.target.value
                    onChange(schema.field_type === "number" ? (v === "" ? null : Number(v)) : v || null)
                }} />
        </div>
    )
}
