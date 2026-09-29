import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { SettingsFrame } from "./settings-frame"

/**
 * One layout for every page under Pengaturan: the settings menu on a desk,
 * the back arrow on a phone (DESIGN.md "Settings layout and page width").
 *
 * It guards nothing on its own. Akun (Profil, Perangkat aktif) is every
 * signed-in person's, and each other page checks its own grant, as it
 * always has; the grant here only decides which groups the menu lists.
 */
export default async function SettingsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  const canOpenSettings = await canPerform(access, "sales_mission_settings", "read")

  return <SettingsFrame canOpenSettings={canOpenSettings}>{children}</SettingsFrame>
}
