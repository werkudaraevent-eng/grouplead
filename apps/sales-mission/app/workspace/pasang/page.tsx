import { redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { WorkspacePage } from "@/app/workspace/workspace-page"
import { pageIntroKey } from "@/lib/hints/hint-key"
import { InstallGuide } from "./install-guide"

export const dynamic = "force-dynamic"

export default async function InstallPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  return (
    <WorkspacePage
      introKey={pageIntroKey("install")}
      title="Pasang di ponsel"
      description="Sales Activity bisa dipasang ke layar utama dan dibuka seperti aplikasi, tanpa unduhan dari toko."
    >
      <div className="max-w-xl">
        <InstallGuide />
      </div>
    </WorkspacePage>
  )
}
