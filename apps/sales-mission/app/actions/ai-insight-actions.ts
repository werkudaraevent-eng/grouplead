"use server"

import { createServiceClient, hasServiceClientConfig } from "@/utils/supabase/service"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMissionSettings } from "@/lib/missions/mission-queries"
import { wibDayOf, wibHourOf } from "@/lib/ai/insight-facts"
import { MAX_REGENERATIONS_PER_DAY, REGENERATION_GAP_MS, countReportsSubmittedOn, generateInsight, readInsight } from "@/lib/ai/insights"
import { resolveInsightScope, toInsightView, type InsightView } from "@/lib/ai/insight-view"
import type { ActionResult } from "@/types/action-result"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"

async function gate() {
  const access = await getSalesMissionAccess()
  if (!access) return { error: NO_ACCESS_MESSAGE }
  if (!(await canPerform(access, "sales_mission_ai", "read"))) return { error: "Anda tidak punya izin melihat insight AI." }
  const settings = await getMissionSettings(access)
  if (!settings.aiInsightsEnabled) return { error: "Insight AI belum dinyalakan di Pengaturan → Aturan aktivitas." }
  if (!hasServiceClientConfig()) return { error: "Deployment ini belum punya kunci service Supabase." }
  return { access, settings }
}

/**
 * Today's insight for the signed-in person, made now if there is none yet
 * (or if reports came in since the last one and the gap has passed). The
 * card calls this on open, so the page itself never waits for a model.
 */
export async function ensureTodayInsight(): Promise<ActionResult<InsightView>> {
  const g = await gate()
  if ("error" in g) return { success: false, error: g.error }
  const { access, settings } = g
  const now = new Date()
  const day = wibDayOf(now)
  const service = createServiceClient()
  const { scope, userId, salesIds } = await resolveInsightScope(access)

  const existing = await readInsight(service, access.companyId, day, scope, userId)
  if (existing && existing.status !== "failed") {
    const reportsToday = await countReportsSubmittedOn(service, access.companyId, day)
    const generatedAt = existing.generatedAt ? new Date(existing.generatedAt).getTime() : now.getTime()
    const behind = reportsToday > existing.reportsSeen && now.getTime() - generatedAt >= REGENERATION_GAP_MS && existing.regenerations < MAX_REGENERATIONS_PER_DAY
    if (!behind || existing.status === "pending") return { success: true, data: toInsightView(existing) }
    const refreshed = await generateInsight(service, { companyId: access.companyId, day, scope, userId, salesIds, trigger: "report", now })
    return { success: true, data: toInsightView(refreshed) }
  }
  if (existing?.status === "failed" && existing.generatedAt && now.getTime() - new Date(existing.generatedAt).getTime() < REGENERATION_GAP_MS) {
    return { success: true, data: toInsightView(existing) }
  }

  // Made on open after the morning hour, this row is the day's morning insight; the schedule need not write it again.
  const trigger = scope === "unit" && wibHourOf(now) >= settings.aiInsightsHour ? "schedule" : "view"
  const record = await generateInsight(service, { companyId: access.companyId, day, scope, userId, salesIds, trigger, now })
  return { success: true, data: toInsightView(record) }
}

/** Rewrite today's insight on request. For people who may change the unit's settings. */
export async function regenerateTodayInsight(): Promise<ActionResult<InsightView>> {
  const g = await gate()
  if ("error" in g) return { success: false, error: g.error }
  const { access } = g
  if (!(await canPerform(access, "sales_mission_settings", "update"))) {
    return { success: false, error: "Buat ulang hanya untuk admin Sales Activity." }
  }
  const now = new Date()
  const day = wibDayOf(now)
  const service = createServiceClient()
  const { scope, userId, salesIds } = await resolveInsightScope(access)
  const existing = await readInsight(service, access.companyId, day, scope, userId)
  if (existing && existing.regenerations >= MAX_REGENERATIONS_PER_DAY) {
    return { success: false, error: `Batas ${MAX_REGENERATIONS_PER_DAY} kali buat ulang per hari sudah tercapai.` }
  }
  const record = await generateInsight(service, { companyId: access.companyId, day, scope, userId, salesIds, trigger: "manual", now })
  return { success: true, data: toInsightView(record) }
}
