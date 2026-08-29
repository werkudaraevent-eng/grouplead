import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase client authenticated by a caller-supplied access token.
 *
 * Used by the `/api/v1` routes that Sales Mission calls. A cross-origin fetch
 * carries no cookies, so the session cannot be read the usual way — but both
 * apps share one Supabase project and one `auth.users`, so the token from a
 * Sales Mission session is valid here.
 *
 * The anon key is deliberate: every query then runs as that user under RLS, and
 * `requirePermission` evaluates their real grants. Reaching for the service key
 * would be easier and would silently bypass both.
 */
export function createBearerClient(accessToken: string) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
        throw new Error(
            'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars'
        )
    }

    return createSupabaseClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    })
}

/** Extract the bearer token from a request, or null when absent/malformed. */
export function readBearerToken(request: Request): string | null {
    const header = request.headers.get('authorization') ?? request.headers.get('Authorization')
    if (!header) return null

    const [scheme, token] = header.split(' ')
    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null

    return token.trim() || null
}
