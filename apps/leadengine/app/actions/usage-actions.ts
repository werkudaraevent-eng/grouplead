"use server"

import { createClient } from "@/utils/supabase/server"
import { isUsagePath, normalizeUsagePath } from "@/lib/usage/usage-path"
import { usageVisitsSchema } from "@/lib/usage/usage-schema"
import { usageDayKey } from "@/lib/usage/usage-stats"
import { isMissingUsageSchema } from "@/lib/usage/usage-queries"
import type { UsageVisit } from "@/lib/usage/usage-beacon"
import type { ActionResult } from "@/types/action-result"

const NOT_RECORDED = "Usage was not recorded."

/** Said once per server instance, so a deploy that is ahead of its migration does not log every page open. */
let warnedMissing = false

/**
 * Settings → Usage's only write: this person opened these pages (views ≥ 1,
 * batched by the beacon at most once per 30 seconds) or is still here (one
 * visit with views 0, the five-minute heartbeat).
 *
 * Never throws and never matters to the page it came from: every failure is
 * logged and answered with `success: false`, which the beacon ignores.
 * Goes through the person's own session, and `record_usage` takes the
 * person from `auth.uid()`, so it writes their row and nobody else's; a
 * signed-out call is refused by the function itself, which saves a round
 * trip to the auth server on every page open.
 */
export async function recordUsage(visits: UsageVisit[]): Promise<ActionResult> {
  try {
    const parsed = usageVisitsSchema.safeParse(visits)
    if (!parsed.success) return { success: false, error: NOT_RECORDED }

    const day = usageDayKey(new Date())
    const supabase = await createClient()
    // In order: the last call's path becomes the person's last page.
    for (const visit of parsed.data) {
      const path = normalizeUsagePath(visit.path)
      if (!isUsagePath(path)) continue
      const { error } = await supabase.rpc("record_usage", { p_path: path, p_day: day, p_views: visit.views })
      if (error) {
        if (isMissingUsageSchema(error)) {
          if (!warnedMissing) console.warn("[recordUsage] record_usage is not there yet (migration 20260923120000 not applied?)", error.code)
          warnedMissing = true
        } else {
          console.error("[recordUsage]", error.code, error.message)
        }
        return { success: false, error: NOT_RECORDED }
      }
    }
    return { success: true }
  } catch (error) {
    console.error("[recordUsage]", error instanceof Error ? error.message : error)
    return { success: false, error: NOT_RECORDED }
  }
}
