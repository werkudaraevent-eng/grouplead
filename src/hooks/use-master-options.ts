import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { MasterOption } from '@/types'

export function useMasterOptions(type?: string, companyId?: string | null) {
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

            // When companyId is provided, include company-specific options AND global options (company_id IS NULL)
            // When companyId is not provided, RLS handles scoping
            if (companyId != null) {
                query = query.or(`company_id.eq.${companyId},company_id.is.null`)
            }

            const { data } = await query

            if (data) {
                setOptions(data as MasterOption[])
            }
            setLoading(false)
        }

        fetchOptions()
    }, [type, companyId])

    return { options, loading }
}
