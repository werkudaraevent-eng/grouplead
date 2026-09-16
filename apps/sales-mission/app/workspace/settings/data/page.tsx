import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { createClient } from "@/utils/supabase/server"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import Link from "next/link"
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
      <WorkspacePage eyebrow="Sales Activity / Pengaturan" title="Data" action={<BackLink href="/workspace/settings" />}>
        <EmptyState title="Tidak punya izin" description="Halaman ini hanya untuk admin Sales Activity." />
      </WorkspacePage>
    )
  }

  const supabase = await createClient()
  const [{ count }, { count: binned }] = await Promise.all([
    supabase.schema("sales_mission").from("missions").select("id", { count: "exact", head: true }).eq("company_id", access.companyId).is("deleted_at", null),
    supabase.schema("sales_mission").from("missions").select("id", { count: "exact", head: true }).eq("company_id", access.companyId).not("deleted_at", "is", null),
  ])

  return (
    <WorkspacePage
      eyebrow="Sales Activity / Pengaturan"
      title="Data"
      description="Mengosongkan data unit bisnis ini. Setiap penghapusan tercatat di Riwayat perubahan."
      action={<BackLink href="/workspace/settings" />}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {binned ?? 0} aktivitas sedang di sampah.{" "}
          <Link href="/workspace/settings/recycle-bin" className="font-semibold text-primary hover:underline">Buka sampah</Link>
        </p>
        <ClearMissions count={count ?? 0} canDelete={canDelete} />
      </div>
    </WorkspacePage>
  )
}
