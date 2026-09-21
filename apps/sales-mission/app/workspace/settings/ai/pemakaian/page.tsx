import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { readAiUsage } from "@/lib/ai/ai-usage"
import { createServiceClient, hasServiceClientConfig } from "@/utils/supabase/service"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { paths } from "@/lib/paths"
import { UsageCard } from "../usage-card"

export const dynamic = "force-dynamic"

/**
 * Pengaturan → AI → Pemakaian: what the proxy has been asked for, in
 * tokens. Its own page rather than a card under the connection form,
 * because a form ends at its Simpan and a read-only ledger is a different
 * task (OpenAI's and Anthropic's consoles keep Usage beside, not under,
 * the API keys). Same width as the form, so the two pages read as one.
 */
export default async function AiUsagePage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const shell = (children: React.ReactNode) => (
    <WorkspacePage
      eyebrow="Sales Activity / Pengaturan / AI"
      title="Pemakaian AI"
      description="Token yang dipakai kedua aplikasi lewat proxy AI, dan perkiraan kebutuhan seminggu dan sebulan."
      action={<BackLink href={paths.settings.ai} />}
    >
      {children}
    </WorkspacePage>
  )

  if (!(await canPerform(access, "sales_mission_settings", "update"))) {
    return shell(<EmptyState title="Tidak punya izin" description="Pemakaian AI hanya dapat dilihat oleh admin Sales Activity." />)
  }
  if (!hasServiceClientConfig()) {
    return shell(<EmptyState title="Belum bisa dibuka" description="Deployment ini belum punya kunci service Supabase, yang diperlukan untuk membaca catatan pemakaian." />)
  }

  const usage = await readAiUsage(createServiceClient())
  return shell(
    <div className="max-w-3xl">
      <UsageCard summary={usage} />
    </div>
  )
}
