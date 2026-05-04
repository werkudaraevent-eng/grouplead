'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Loader2 } from 'lucide-react'

/**
 * Deprecated: Company members are now managed via User Management with BU filter.
 * This page redirects to /settings/users?bu=CompanyName for backward compatibility.
 */
export default function CompanyMembersRedirect() {
    const params = useParams()
    const router = useRouter()
    const slug = params.slug as string
    const [resolving, setResolving] = useState(true)

    useEffect(() => {
        const resolve = async () => {
            const supabase = createClient()
            const { data } = await supabase
                .from('companies')
                .select('name')
                .eq('slug', slug)
                .single()

            if (data?.name) {
                router.replace('/settings/users?bu=' + encodeURIComponent(data.name))
            } else {
                router.replace('/settings/users')
            }
            setResolving(false)
        }
        resolve()
    }, [slug, router])

    if (!resolving) return null

    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
                <span className="text-xs text-muted-foreground">Redirecting to User Management...</span>
            </div>
        </div>
    )
}
