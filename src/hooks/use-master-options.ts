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
        const fetchOptions = async () => {
            setLoading(true)
            const supabase = createClient()
            let query = supabase.from('master_options').select('*').eq('is_active', true)

            if (type) {
                query = query.eq('option_type', type)
            }

            // No company_id filter — master_options is global reference data.
            // RLS policy "master_options_select_global" USING (true) handles access.

            const { data } = await query.order('sort_order', { ascending: true }).order('label', { ascending: true })

            if (data) {
                setOptions(data as MasterOption[])
            }
            setLoading(false)
        }

        fetchOptions()
    }, [type])

    return { options, loading }
}
