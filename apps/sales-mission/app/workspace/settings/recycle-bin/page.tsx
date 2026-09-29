import { redirect } from "next/navigation"
import { getSalesMissionAccess, isSettingsAdmin } from "@/lib/sales-mission-access"
import { listDeletedMissions, purgeExpiredMissions } from "@/lib/missions/recycle-bin-queries"
import { RETENTION_DAYS } from "@/lib/missions/recycle-bin"
import { EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { pageIntroKey } from "@/lib/hints/hint-key"
import { RecycleBinList } from "./recycle-bin-list"
import { ProspectBinList } from "./prospect-bin-list"
import { listDeletedProspects, purgeExpiredProspects } from "@/lib/prospects/prospect-bin-queries"

export const dynamic = "force-dynamic"

/**
 * The recycle bin. Everything deleted from the mission list lands here
 * first; an admin or super admin restores it or removes it for good, and
 * what is older than the retention period is purged on the way in.
 */
export default async function RecycleBinPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const canManage = await isSettingsAdmin(access)
  if (!canManage) {
    return (
      <WorkspacePage wide title="Sampah">
        <EmptyState title="Tidak punya izin" description="Hanya admin dan super admin yang bisa memulihkan atau menghapus permanen." />
      </WorkspacePage>
    )
  }

  const now = new Date()
  await Promise.all([purgeExpiredMissions(access, now), purgeExpiredProspects(access, now)])
  const [items, prospects] = await Promise.all([listDeletedMissions(access), listDeletedProspects(access)])

  return (
    <WorkspacePage
      wide
      introKey={pageIntroKey("settings-recycle-bin")}
      title="Sampah"
      description={`Aktivitas dan prospek yang dihapus disimpan ${RETENTION_DAYS} hari, lalu dihapus permanen. Laporan, penugasan, dan catatan di dalamnya ikut kembali saat dipulihkan.`}
    >
      <section aria-label="Aktivitas di sampah">
        <h2 className="mb-2 text-base font-semibold text-foreground">Aktivitas</h2>
        <RecycleBinList items={items} now={now.toISOString()} />
      </section>
      <section className="mt-8" aria-label="Prospek di sampah">
        <h2 className="mb-2 text-base font-semibold text-foreground">Prospek</h2>
        <ProspectBinList items={prospects} now={now.toISOString()} />
      </section>
    </WorkspacePage>
  )
}
