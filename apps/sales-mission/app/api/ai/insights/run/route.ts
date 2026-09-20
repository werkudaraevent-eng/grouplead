import { NextResponse } from "next/server"
import { createServiceClient, hasServiceClientConfig } from "@/utils/supabase/service"
import { wibDayOf } from "@/lib/ai/insight-facts"
import { countReportsSubmittedOn, dueTrigger, generateInsight, readInsight } from "@/lib/ai/insights"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * The scheduled run. Supabase Cron calls this every ten minutes with the
 * bearer token kept in Vault (see migration 20260920110000); the route
 * compares the token, then looks at every unit that has insights switched on
 * and writes what is due: the morning insight once the unit's hour has come,
 * a rewrite when reports came in after the last one. Idle ticks cost one
 * query per unit and no model call.
 */
export async function POST(request: Request) {
  if (!hasServiceClientConfig()) return NextResponse.json({ error: "service_key_missing" }, { status: 503 })
  const service = createServiceClient()

  const { data: secret } = await service.rpc("fn_ai_read_cron_secret")
  const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? ""
  if (!secret || typeof secret !== "string" || !presented || presented !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const day = wibDayOf(now)
  const { data: units } = await service
    .schema("sales_mission")
    .from("mission_settings")
    .select("company_id, ai_insights_hour")
    .eq("ai_insights_enabled", true)

  const results: Array<{ companyId: string; action: string; status?: string }> = []
  for (const unit of units ?? []) {
    const companyId = unit.company_id as string
    const hour = typeof unit.ai_insights_hour === "number" ? unit.ai_insights_hour : 6
    try {
      const existing = await readInsight(service, companyId, day, "unit", null)
      const reportsToday = await countReportsSubmittedOn(service, companyId, day)
      const trigger = dueTrigger(existing, { hour }, reportsToday, now)
      if (!trigger) {
        results.push({ companyId, action: "none" })
        continue
      }
      const record = await generateInsight(service, { companyId, day, scope: "unit", userId: null, salesIds: null, trigger, now })
      results.push({ companyId, action: trigger, status: record.status })
    } catch (error) {
      console.error("[ai-insights/run]", companyId, error)
      results.push({ companyId, action: "error", status: error instanceof Error ? error.message : "unknown" })
    }
  }

  return NextResponse.json({ day, ran: results })
}
