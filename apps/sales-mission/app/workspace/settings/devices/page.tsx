import { redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { WorkspacePage } from "@/app/workspace/workspace-page"
import { pageIntroKey } from "@/lib/hints/hint-key"
import { listMyDevices } from "@/lib/devices/device-queries"
import { toDeviceViews } from "@/lib/devices/device-display"
import { DeviceList, SignOutOthersButton } from "./device-list"

export const dynamic = "force-dynamic"

/**
 * Perangkat aktif: where this account is signed in. Several devices may be
 * signed in at once (a laptop at the desk, the phone in the field); this is
 * where one of them, or all the others, is signed out. The same list as
 * LeadEngine's Settings › Account › Active devices, since one sign-in
 * covers both apps.
 *
 * In Pengaturan › Akun, which every signed-in person sees (a rep included):
 * it needs no grant, only a session. The old address, /workspace/perangkat,
 * redirects here (next.config.ts).
 */
export default async function DevicesPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const { rows, failed } = await listMyDevices()
  const devices = toDeviceViews(rows, new Date())
  const others = devices.filter((device) => !device.isCurrent).length

  return (
    <WorkspacePage
      introKey={pageIntroKey("devices")}
      title="Perangkat aktif"
      description="Tempat akunmu sedang masuk. Satu kali masuk berlaku untuk Sales Activity dan Group Lead."
      action={others > 0 ? <SignOutOthersButton count={others} /> : undefined}
      phoneAction={false}
    >
      <DeviceList devices={devices} failed={failed} />
    </WorkspacePage>
  )
}
