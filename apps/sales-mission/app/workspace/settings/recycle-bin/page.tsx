import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listDeletedMissions, purgeExpiredMissions } from "@/lib/missions/recycle-bin-queries"
import { RETENTION_DAYS } from "@/lib/missions/recycle-bin"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { RecycleBinList } from "./recycle-bin-list"

export const dynamic = "force-dynamic"

/**
 * The recycle bin. Everything deleted from the mission list lands here
 * first; an admin or super admin restores it or removes it for good, and
 * what is older than the retention period is purged on the way in.
 */
export default async function RecycleBinPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const canManage = access.isSuperAdmin || (await canPerform(access, "sales_mission_settings", "update"))
  if (!canManage) {
    return (
      <WorkspacePage eyebrow="Sales Mission / Pengaturan" title="Sampah" action={<BackLink href="/workspace/settings" />}>
        <EmptyState title="Tidak punya izin" description="Hanya admin dan super admin yang bisa memulihkan atau menghapus permanen." />
      </WorkspacePage>
    )
  }

  const now = new Date()
  await purgeExpiredMissions(access, now)
  const items = await listDeletedMissions(access)

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Pengaturan"
      title="Sampah"
      description={`Mission yang dihapus disimpan ${RETENTION_DAYS} hari, lalu dihapus permanen. Laporan, penugasan, dan catatan di dalamnya ikut kembali saat dipulihkan.`}
      action={<BackLink href="/workspace/settings" />}
    >
      <RecycleBinList items={items} now={now.toISOString()} />
    </WorkspacePage>
  )
}
