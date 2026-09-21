import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { announcementStates, type AnnouncementRow, type AnnouncementState } from "./announcements"

/**
 * The unit's announcement switches applied to the code's announceable
 * releases. Read once per workspace render; a failure means "the defaults",
 * which at worst announces what the code meant to.
 */
export async function listAnnouncements(access: SalesMissionAccess): Promise<AnnouncementState[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("release_announcements")
    .select("key, enabled, announced_at")
    .eq("company_id", access.companyId)
  return announcementStates(error || !data ? [] : (data as AnnouncementRow[]))
}
