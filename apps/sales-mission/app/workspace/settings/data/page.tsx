import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { createClient } from "@/utils/supabase/server"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { ClearMissions } from "./clear-missions"

export const dynamic = "force-dynamic"

/**
 * Data. Today one thing lives here: emptying the missions, for a unit that
 * has been trialling and wants to start clean. Kept away from the mission
 * list on purpose; a "delete everything" next to "delete these" is how the
 * wrong one gets pressed.
 */
export default async function DataSettingsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const [canManage, canDelete] = await Promise.all([
    canPerform(access, "sales_mission_settings", "update"),
    canPerform(access, "sales_mission_mission", "delete"),
  ])

  if (!canManage) {
    return (
      <WorkspacePage eyebrow="Sales Mission / Pengaturan" title="Data" action={<BackLink href="/workspace/settings" />}>
        <EmptyState title="Tidak punya izin" description="Halaman ini hanya untuk admin Sales Mission." />
      </WorkspacePage>
    )
  }

  const supabase = await createClient()
  const { count } = await supabase
    .schema("sales_mission")
    .from("missions")
    .select("id", { count: "exact", head: true })
    .eq("company_id", access.companyId)

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Pengaturan"
      title="Data"
      description="Mengosongkan data unit bisnis ini. Setiap penghapusan tercatat di Riwayat aktivitas."
      action={<BackLink href="/workspace/settings" />}
    >
      <ClearMissions count={count ?? 0} canDelete={canDelete} />
    </WorkspacePage>
  )
}
