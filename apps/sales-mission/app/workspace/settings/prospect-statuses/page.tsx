import { redirect } from "next/navigation"
import { getSalesMissionAccess, isSettingsAdmin } from "@/lib/sales-mission-access"
import { listProspectStatuses, countProspectsByStatus } from "@/lib/prospects/prospect-status-queries"
import { EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { pageIntroKey } from "@/lib/hints/hint-key"
import { StatusManager } from "./status-manager"

export const dynamic = "force-dynamic"

export default async function ProspectStatusesPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  const canManage = await isSettingsAdmin(access)
  if (!canManage) {
    return (
      <WorkspacePage title="Status prospek">
        <EmptyState title="Tidak punya izin" description="Halaman ini hanya untuk admin Sales Activity." />
      </WorkspacePage>
    )
  }

  const statuses = await listProspectStatuses(access, { includeArchived: true })
  const usage = await countProspectsByStatus(access, statuses.map((status) => status.id))

  return (
    <WorkspacePage
      introKey={pageIntroKey("settings-prospect-statuses")}
      title="Status prospek"
      description="Nama, warna, dan urutan status milik tim. Jenis di balik tiap status terkunci, karena jenis itulah yang menentukan status awal, status janji temu berhasil, dan cara corong dihitung."
    >
      <StatusManager statuses={statuses} usage={usage} />
    </WorkspacePage>
  )
}
