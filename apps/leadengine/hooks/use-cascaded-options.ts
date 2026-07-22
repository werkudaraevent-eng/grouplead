import { useMemo } from 'react'
import { useMasterOptions } from './use-master-options'
import { useCascadeRelations } from './use-cascade-relations'
import type { MasterOption } from '@/types'

interface CascadedOptionsResult {
    /** All active options for this type */
    allOptions: MasterOption[]
    /** Filtered options based on parent value (or all if no cascade) */
    options: MasterOption[]
    loading: boolean
    /** The parent category key (e.g. "custom_companies__segment") or null */
    parentCategory: string | null
    /** Whether this field should be disabled (parent exists but no value selected) */
    isDisabledByParent: boolean
}

/**
 * Drop-in replacement for useMasterOptions that automatically applies
 * cascade filtering based on cascade_relations system setting.
 *
 * @param type - The option_type (e.g. "line_industry", "stream_type")
 * @param parentValue - The current value of the parent field (null if not selected)
 * @param companyIds - Deprecated, kept for compat
 */
export function useCascadedOptions(
    type: string,
    parentValue?: string | null,
    companyIds?: string | string[] | null,
): CascadedOptionsResult {
    const { options: allOptions, loading } = useMasterOptions(type, companyIds)
    const cascadeRelations = useCascadeRelations()

    const parentCategory = cascadeRelations[type] ?? null

    const options = useMemo(() => {
        if (!parentCategory) return allOptions // no cascade, return all
        if (!parentValue) return [] // parent not selected
        return allOptions.filter(o => o.parent_value === parentValue)
    }, [allOptions, parentCategory, parentValue])

    const isDisabledByParent = !!parentCategory && !parentValue

    return { allOptions, options, loading, parentCategory, isDisabledByParent }
}
