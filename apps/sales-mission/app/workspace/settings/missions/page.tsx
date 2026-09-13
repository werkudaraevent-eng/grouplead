import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMissionSettings } from "@/lib/missions/mission-queries"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { MissionSettingsForm } from "./mission-settings-form"

export const dynamic = "force-dynamic"

export default async function MissionSettingsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  if (!(await canPerform(access, "sales_mission_settings", "update"))) {
    return (
      <WorkspacePage
        eyebrow="Sales Mission / Pengaturan"
        title="Aturan mission"
        action={<BackLink href="/workspace/settings" />}
      >
        <EmptyState title="Tidak punya izin" description="Aturan mission hanya dapat diubah oleh admin Sales Mission." />
      </WorkspacePage>
    )
  }

  const settings = await getMissionSettings(access)

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Pengaturan"
      title="Aturan mission"
      description="Penugasan, batas tim, dan pemeriksaan bentrok jadwal untuk unit bisnis ini."
      action={<BackLink href="/workspace/settings" />}
    >
      <MissionSettingsForm initial={settings} />
    </WorkspacePage>
  )
}
