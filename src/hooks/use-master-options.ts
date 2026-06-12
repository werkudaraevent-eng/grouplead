import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { MasterOption } from '@/types'

/**
 * Fetches master options, filtered by type.
 * master_options is GLOBAL REFERENCE DATA — RLS allows all authenticated
 * users to read all rows. No client-side company filtering needed.
 *
 * @param type - option_type to filter by (e.g. "category", "lead_source")
 * @param _companyIds - DEPRECATED. Kept for backward-compat call-sites.
 *   No longer used for filtering. RLS handles scoping.
 */
export function useMasterOptions(type?: string, _companyIds?: string | string[] | null) {
    const [options, setOptions] = useState<MasterOption[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // No type → nothing to load. Clear any stale options so callers that
        // toggle the type (e.g. inline popovers passing `undefined` while
        // closed) never flash the previous/global option list.
        if (!type) {
            setOptions([])
            setLoading(false)
            return
        }

        let cancelled = false
        const fetchOptions = async () => {
            setLoading(true)
            // Drop the previous type's options immediately so a stale list
            // can't render during the fetch for the new type.
            setOptions([])
            const supabase = createClient()
            const query = supabase
                .from('master_options')
                .select('*')
                .eq('is_active', true)
                .eq('option_type', type)

            // No company_id filter — master_options is global reference data.
            // RLS policy "master_options_select_global" USING (true) handles access.

            const { data } = await query.order('sort_order', { ascending: true }).order('label', { ascending: true })

            if (cancelled) return
            if (data) {
                setOptions(data as MasterOption[])
            }
            setLoading(false)
        }

        fetchOptions()
        return () => { cancelled = true }
    }, [type])

    return { options, loading }
}
