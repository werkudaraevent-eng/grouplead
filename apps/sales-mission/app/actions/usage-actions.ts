"use server"

import { createClient } from "@/utils/supabase/server"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { missionDayKey } from "@/lib/missions/mission-calendar"
import { normalizeUsagePath, isUsagePath } from "@/lib/usage/usage-path"
import { usageVisitsSchema } from "@/lib/usage/usage-schema"
import type { UsageVisit } from "@/lib/usage/usage-beacon"
import type { ActionResult } from "@/types/action-result"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"

const NOT_RECORDED = "Pemakaian tidak tercatat."

/**
 * Pengaturan → Pemakaian's only write: this person opened these pages
 * (views ≥ 1, batched by the beacon at most once per 30 seconds) or is
 * still here (one visit with views 0, the five-minute heartbeat).
 *
 * Never throws and never matters to the page it came from: every failure is
 * logged and answered with `success: false`, which the beacon ignores. Goes
 * through the person's own session, so `record_usage` writes their row and
 * nobody else's.
 */
export async function recordUsage(visits: UsageVisit[]): Promise<ActionResult> {
  try {
    const parsed = usageVisitsSchema.safeParse(visits)
    if (!parsed.success) return { success: false, error: NOT_RECORDED }

    const access = await getSalesMissionAccess()
    if (!access) return { success: false, error: NO_ACCESS_MESSAGE }

    const day = missionDayKey(new Date())
    const supabase = await createClient()
    // In order: the last call's path becomes the person's last page.
    for (const visit of parsed.data) {
      const path = normalizeUsagePath(visit.path)
      if (!isUsagePath(path)) continue
      const { error } = await supabase.schema("sales_mission").rpc("record_usage", {
        p_company_id: access.companyId,
        p_path: path,
        p_day: day,
        p_views: visit.views,
      })
      if (error) {
        console.error("[recordUsage]", error.code, error.message)
        return { success: false, error: NOT_RECORDED }
      }
    }
    return { success: true }
  } catch (error) {
    console.error("[recordUsage]", error instanceof Error ? error.message : error)
    return { success: false, error: NOT_RECORDED }
  }
}
