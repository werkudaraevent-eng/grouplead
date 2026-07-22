import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

const DEFAULT_CASCADE_RELATIONS: Record<string, string> = {
    stream_type: "main_stream",
    business_purpose: "stream_type",
}

let cachedRelations: Record<string, string> | null = null
let fetchPromise: Promise<Record<string, string>> | null = null

/**
 * Returns the cascade relations map (child → parent category).
 * Loads from DB once and caches globally.
 * Falls back to hardcoded defaults if DB has no setting.
 */
export function useCascadeRelations() {
    const [relations, setRelations] = useState<Record<string, string>>(
        cachedRelations ?? DEFAULT_CASCADE_RELATIONS
    )

    useEffect(() => {
        if (cachedRelations) { setRelations(cachedRelations); return }

        if (!fetchPromise) {
            fetchPromise = (async () => {
                const supabase = createClient()
                const { data } = await supabase
                    .from("master_options")
                    .select("value")
                    .eq("option_type", "system_setting")
                    .eq("label", "cascade_relations")
                    .limit(1)
                    .single()
                if (data?.value) {
                    try {
                        const parsed = JSON.parse(data.value)
                        if (typeof parsed === "object" && parsed !== null) {
                            cachedRelations = parsed
                            return parsed
                        }
                    } catch { /* ignore */ }
                }
                cachedRelations = DEFAULT_CASCADE_RELATIONS
                return DEFAULT_CASCADE_RELATIONS
            })()
        }

        fetchPromise.then(r => setRelations(r))
    }, [])

    return relations
}

/** Invalidate the cache so next useCascadeRelations call re-fetches */
export function invalidateCascadeCache() {
    cachedRelations = null
    fetchPromise = null
}
