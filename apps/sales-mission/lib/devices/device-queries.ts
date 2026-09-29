import { createClient } from "@/utils/supabase/server"
import type { DeviceRow } from "./device-display"

/**
 * The signed-in person's live sessions, from `public.fn_list_my_devices()`:
 * the same list LeadEngine's Active devices page reads, because one sign-in
 * covers both apps. The function answers for the caller's own token only.
 */
export async function listMyDevices(): Promise<{ rows: DeviceRow[]; failed: boolean }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("fn_list_my_devices")
  if (error) return { rows: [], failed: true }
  return { rows: (data ?? []) as DeviceRow[], failed: false }
}
