"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { createServiceClient } from "@/utils/supabase/service"
import { requirePermission } from "@/lib/require-permission"
import { computeMonthEvent } from "@/features/leads/lib/compute-month-event"
import type { ActionResult } from "@/types"
import type { CurrencyFormat, CurrencyPrefix } from "@/types/currency"

export async function updateCurrencySettingsAction(
  companyId: string,
  data: { currency_format: CurrencyFormat; currency_prefix: CurrencyPrefix }
): Promise<ActionResult> {
  try {
    const guard = await requirePermission('settings', 'update', companyId)
    if (!guard.allowed) return guard.error

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { error } = await supabase
      .from("company_settings")
      .upsert(
        {
          company_id: companyId,
          currency_format: data.currency_format,
          currency_prefix: data.currency_prefix,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" }
      )

    if (error) return { success: false, error: error.message }

    revalidatePath("/", "layout")
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

// ─── Revenue-Recognition month recalculation ────────────────────────────────
//
// Recomputes `month_event` for leads from their event dates + the current
// cut-off rule. NEVER touches rows flagged `month_event_source = 'manual'`
// (deliberate user overrides / tentative entries). Rows it writes are tagged
// 'auto' so subsequent runs keep them in sync.
//
// `apply = false` (default) is a dry run: it returns how many rows WOULD
// change plus a small sample, without writing anything.

export interface RecalcMonthEventResult {
  wouldChange: number
  unchanged: number
  skippedManual: number
  skippedNoDates: number
  applied: number
  cutoffDay: number
  sample: { id: string; name: string; from: string | null; to: string }[]
}

export async function recalcMonthEventAction(
  apply = false,
): Promise<ActionResult<RecalcMonthEventResult>> {
  try {
    const guard = await requirePermission("master_options", "update")
    if (!guard.allowed) return guard.error

    const admin = createServiceClient()

    // Resolve the company-wide cut-off day (falls back to 25).
    const { data: cutoffRow } = await admin
      .from("master_options")
      .select("value")
      .eq("option_type", "system_setting")
      .eq("label", "event_cutoff_date")
      .maybeSingle()
    const parsed = cutoffRow?.value ? parseInt(cutoffRow.value, 10) : NaN
    const cutoffDay = Number.isFinite(parsed) && parsed >= 1 && parsed <= 31 ? parsed : 25

    // Page through leads with event dates.
    type Row = {
      id: number
      project_name: string | null
      event_dates: string[] | null
      month_event: string | null
      month_event_source: "auto" | "manual" | null
    }
    const PAGE = 1000
    let from = 0
    const all: Row[] = []
    for (;;) {
      const { data, error } = await admin
        .from("leads")
        .select("id, project_name, event_dates, month_event, month_event_source")
        .not("event_dates", "is", null)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) return { success: false, error: error.message }
      if (!data || data.length === 0) break
      all.push(...(data as Row[]))
      if (data.length < PAGE) break
      from += PAGE
    }

    const changes: { id: number; name: string; from: string | null; to: string }[] = []
    let unchanged = 0
    let skippedManual = 0
    let skippedNoDates = 0

    for (const lead of all) {
      if (lead.month_event_source === "manual") { skippedManual++; continue }
      const dates = Array.isArray(lead.event_dates) ? lead.event_dates : []
      if (dates.length === 0) { skippedNoDates++; continue }
      const computed = computeMonthEvent(dates, cutoffDay)
      if (!computed) { skippedNoDates++; continue }
      if (computed === lead.month_event && lead.month_event_source === "auto") { unchanged++; continue }
      changes.push({ id: lead.id, name: lead.project_name ?? "(untitled)", from: lead.month_event, to: computed })
    }

    const sample = changes.slice(0, 20).map(c => ({ id: String(c.id), name: c.name, from: c.from, to: c.to }))

    let applied = 0
    if (apply && changes.length > 0) {
      for (const c of changes) {
        const { error } = await admin
          .from("leads")
          .update({ month_event: c.to, month_event_source: "auto" })
          .eq("id", c.id)
        if (!error) applied++
      }
      revalidatePath("/", "layout")
    }

    return {
      success: true,
      data: {
        wouldChange: changes.length,
        unchanged,
        skippedManual,
        skippedNoDates,
        applied,
        cutoffDay,
        sample,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}
