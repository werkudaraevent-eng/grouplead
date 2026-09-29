"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { readRequestPlace } from "@/lib/devices/geo-headers"
import { deviceErrorMessage, signOutDeviceSchema, touchDeviceSchema } from "@/lib/devices/device-schema"
import { paths } from "@/lib/paths"
import type { ActionResult } from "@/types/action-result"

/**
 * Perangkat aktif: where this account is signed in, shared with LeadEngine.
 *
 * The database does the work and the checks (`public.fn_touch_device`,
 * `fn_sign_out_device`, `fn_sign_out_other_devices`, migration
 * 20260929130000_user_devices.sql): each acts on the caller's own sessions
 * only, read from the token this request carries. These actions add what
 * only a server has: Vercel's geo headers for the touch.
 */

/**
 * This device is in use, in Sales Activity. Called by the shell on load and,
 * throttled, when the tab comes back to the front. Never fails loudly: a
 * missed touch only leaves "last active" a little older.
 */
export async function touchDevice(input: unknown): Promise<ActionResult> {
  const parsed = touchDeviceSchema.safeParse(input ?? {})
  if (!parsed.success) return { success: false, error: "Data perangkat tidak valid." }

  const requestHeaders = await headers()
  const place = readRequestPlace((name) => requestHeaders.get(name))
  const supabase = await createClient()
  const { error } = await supabase.rpc("fn_touch_device", {
    p_app: "sales_activity",
    p_user_agent: parsed.data.userAgent ?? requestHeaders.get("user-agent"),
    p_city: place.city,
    p_country: place.country,
  })
  if (error) return { success: false, error: "Perangkat tidak tercatat." }
  return { success: true }
}

/** Sign one of the caller's other devices out, in both apps. */
export async function signOutDevice(input: unknown): Promise<ActionResult> {
  const parsed = signOutDeviceSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Perangkat tidak dikenal." }

  const supabase = await createClient()
  const { error } = await supabase.rpc("fn_sign_out_device", { p_session_id: parsed.data.sessionId })
  if (error) return { success: false, error: deviceErrorMessage(error.message) }

  revalidatePath(paths.devices)
  return { success: true }
}

/** Sign out everywhere but this device. Returns how many devices were signed out. */
export async function signOutOtherDevices(): Promise<ActionResult<{ count: number }>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("fn_sign_out_other_devices")
  if (error) return { success: false, error: deviceErrorMessage(error.message) }

  revalidatePath(paths.devices)
  return { success: true, data: { count: typeof data === "number" ? data : 0 } }
}
