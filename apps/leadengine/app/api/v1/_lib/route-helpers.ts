import { NextResponse } from 'next/server'
import { createBearerClient, readBearerToken } from '@/utils/supabase/bearer'

/**
 * Shared plumbing for the `/api/v1` surface Sales Mission calls.
 *
 * Every response — success or failure — uses one shape, so the client can parse
 * errors without guessing which layer produced them:
 *   { error: { code, message, details? } }
 */

export interface ApiErrorBody {
    error: { code: string; message: string; details?: unknown }
}

export function apiError(status: number, code: string, message: string, details?: unknown) {
    const body: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } }
    return NextResponse.json(body, { status })
}

export interface AuthenticatedContext {
    supabase: ReturnType<typeof createBearerClient>
    userId: string
}

/**
 * Resolve the caller from their bearer token.
 *
 * Returns a ready-to-send error response rather than throwing, so each route
 * stays a straight line: authenticate, validate, act.
 */
export async function authenticate(
    request: Request
): Promise<{ ok: true; context: AuthenticatedContext } | { ok: false; response: NextResponse }> {
    const token = readBearerToken(request)
    if (!token) {
        return {
            ok: false,
            response: apiError(401, 'missing_token', 'Authorization bearer token is required.'),
        }
    }

    const supabase = createBearerClient(token)
    const { data, error } = await supabase.auth.getUser()

    if (error || !data.user) {
        return { ok: false, response: apiError(401, 'invalid_token', 'Access token is invalid or expired.') }
    }

    return { ok: true, context: { supabase, userId: data.user.id } }
}

/**
 * Company the caller is acting for.
 *
 * A client-supplied company id is never trusted on its own: it is checked
 * against the caller's own memberships before use. Without an explicit id the
 * caller's first membership is used, matching the rest of the app.
 */
export async function resolveCompanyId(
    context: AuthenticatedContext,
    requested?: string | null
): Promise<string | null> {
    if (requested) {
        const { data } = await context.supabase
            .from('company_members')
            .select('company_id')
            .eq('user_id', context.userId)
            .eq('company_id', requested)
            .maybeSingle()

        return data?.company_id ?? null
    }

    const { data } = await context.supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', context.userId)
        .limit(1)
        .maybeSingle()

    return data?.company_id ?? null
}
