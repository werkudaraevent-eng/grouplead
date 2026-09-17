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

/** The unit's default layout as raw JSON, published by an admin, or null when none was set. */
export async function readCompanyDashboard(access: SalesMissionAccess): Promise<unknown | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.schema("sales_mission").from("company_dashboards").select("layout").eq("company_id", access.companyId).maybeSingle()
  if (error) {
    console.error("[readCompanyDashboard]", error.code, error.message)
    return null
  }
  return data?.layout ?? null
}
