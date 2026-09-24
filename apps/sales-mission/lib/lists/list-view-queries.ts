import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { normalizeViewConfig, type SavedListKey, type SavedListView } from "./list-views"

/**
 * The person's saved views of one list, through their own session: row
 * security keeps them to their own rows in their own unit, and the query
 * still names both so the index is used.
 *
 * A deployment that runs before the table's migration has no views and
 * cannot save one; that is `available: false`, never an error on the list.
 */
export async function listSavedViews(access: SalesMissionAccess, list: SavedListKey): Promise<{ views: SavedListView[]; available: boolean }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .schema("sales_mission")
      .from("list_views")
      .select("id, name, is_default, config")
      .eq("user_id", access.userId)
      .eq("company_id", access.companyId)
      .eq("list_key", list)
      .order("created_at", { ascending: true })
    if (error) {
      console.error("[listSavedViews]", error.code, error.message)
      return { views: [], available: false }
    }
    return {
      views: (data ?? []).map((row) => ({
        id: row.id as string,
        name: (row.name as string | null) ?? "Tampilan",
        isDefault: row.is_default === true,
        config: normalizeViewConfig(list, row.config),
      })),
      available: true,
    }
  } catch (error) {
    console.error("[listSavedViews]", error instanceof Error ? error.message : error)
    return { views: [], available: false }
  }
}
