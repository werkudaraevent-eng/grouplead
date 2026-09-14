import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client. Bypasses RLS.
 *
 * Only for paths where there is no user session to evaluate policies against —
 * today that means the TV board, which is opened by a screen holding a token
 * rather than by a person holding a login.
 *
 * Every query made with this client must filter by `company_id` explicitly.
 * RLS is not there to catch a forgotten filter, so the filter is the boundary.
 */
/**
 * Whether the service key is present at all. Pages that need it check this
 * first and say so, because a missing deployment secret used to surface as a
 * generic "connection lost" error screen that sent people to check their
 * signal.
 */
export function hasServiceClientConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL env vars")
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
