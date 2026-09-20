import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { readAiSettings } from "@/lib/ai/ai-settings"
import { hasServiceClientConfig } from "@/utils/supabase/service"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { paths } from "@/lib/paths"
import { AiSettingsForm } from "./ai-settings-form"

export const dynamic = "force-dynamic"

export default async function AiSettingsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const shell = (children: React.ReactNode) => (
    <WorkspacePage
      eyebrow="Sales Activity / Pengaturan"
      title="AI"
      description="Koneksi ke proxy AI yang dipakai kedua aplikasi: alamat endpoint, kunci API, dan model yang dipilih dari daftar endpoint itu."
      action={<BackLink href={paths.settings.index} />}
    >
      {children}
    </WorkspacePage>
  )

  if (!(await canPerform(access, "sales_mission_settings", "update"))) {
    return shell(<EmptyState title="Tidak punya izin" description="Pengaturan AI hanya dapat diubah oleh admin Sales Activity." />)
  }
  if (!hasServiceClientConfig()) {
    return shell(<EmptyState title="Belum bisa dibuka" description="Deployment ini belum punya kunci service Supabase, yang diperlukan untuk menyimpan kunci API ke Vault." />)
  }

  const settings = await readAiSettings()
  return shell(<AiSettingsForm initial={settings} />)
}
