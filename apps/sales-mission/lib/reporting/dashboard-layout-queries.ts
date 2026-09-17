import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"

/** The person's saved Ringkasan layout as raw JSON, or null. A read error is a default layout, not a broken page. */
export async function readDashboardLayout(access: SalesMissionAccess): Promise<unknown | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.schema("sales_mission").from("user_dashboards").select("layout").eq("user_id", access.userId).maybeSingle()
  if (error) {
    console.error("[readDashboardLayout]", error.code, error.message)
    return null
  }
  return data?.layout ?? null
}
