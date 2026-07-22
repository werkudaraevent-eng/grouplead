import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client with service role key.
 * Bypasses RLS — use only in trusted server actions.
 *
 * Consolidates the former `getAdminClient()` functions that were
 * duplicated in user-actions.ts and auth-actions.ts.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL env vars'
    )
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
