"use server"

import { headers } from "next/headers"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { readRequestPlace } from "@/lib/devices/geo-headers"
import type { ActionResult } from "@/types"

/**
 * Active devices: this device is in use, in LeadEngine.
 *
 * Called by the shell on load and, throttled, when the tab comes back to the
 * front (`SessionWatch`). The database does the work and the checks
 * (`public.fn_touch_device`, migration 20260929130000_user_devices.sql: the
 * caller's own current session only, at most one write per five minutes);
 * this adds what only a server has, Vercel's geo headers. Listing and
 * signing out go straight to their functions from the card, under the
 * person's own session.
 *
 * Never fails loudly: a missed touch only leaves "last active" a little older.
 */

const touchSchema = z.object({
    userAgent: z.string().max(1024).optional(),
})

export async function touchDevice(input: unknown): Promise<ActionResult> {
    const parsed = touchSchema.safeParse(input ?? {})
    if (!parsed.success) return { success: false, error: "Invalid device details" }

    const requestHeaders = await headers()
    const place = readRequestPlace((name) => requestHeaders.get(name))
    const supabase = await createClient()
    const { error } = await supabase.rpc("fn_touch_device", {
        p_app: "leadengine",
        p_user_agent: parsed.data.userAgent ?? requestHeaders.get("user-agent"),
        p_city: place.city,
        p_country: place.country,
    })
    if (error) return { success: false, error: "The device was not recorded" }
    return { success: true }
}
