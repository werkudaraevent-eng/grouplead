import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listProspectStatuses, countProspectsByStatus } from "@/lib/prospects/prospect-status-queries"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { StatusManager } from "./status-manager"

export const dynamic = "force-dynamic"

export default async function ProspectStatusesPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  const canManage = access.isSuperAdmin || (await canPerform(access, "sales_mission_settings", "update"))
  if (!canManage) {
    return (
      <WorkspacePage eyebrow="Sales Mission / Pengaturan" title="Status prospek" action={<BackLink href="/workspace/settings" />}>
        <EmptyState title="Tidak punya izin" description="Halaman ini hanya untuk admin Sales Mission." />
      </WorkspacePage>
    )
  }

  const statuses = await listProspectStatuses(access, { includeArchived: true })
  const usage = await countProspectsByStatus(access, statuses.map((status) => status.id))

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Pengaturan"
      title="Status prospek"
      description="Nama, warna, dan urutan status milik tim. Jenis di balik tiap status terkunci, karena jenis itulah yang menentukan status awal, status janji temu berhasil, dan cara corong dihitung."
      action={<BackLink href="/workspace/settings" />}
    >
      <StatusManager statuses={statuses} usage={usage} />
    </WorkspacePage>
  )
}
