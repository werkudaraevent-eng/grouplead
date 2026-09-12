import { redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { countUnreadNotifications } from "@/lib/notifications/notification-queries"
import { resolveNavAccess } from "@/lib/missions/nav-access"
import { WorkspaceShell } from "./workspace-shell"

export const dynamic = "force-dynamic"

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const [unreadCount, navAccess] = await Promise.all([
    countUnreadNotifications(access),
    resolveNavAccess(access),
  ])

  return (
    <WorkspaceShell displayName={access.displayName} unreadCount={unreadCount} navAccess={navAccess}>
      {children}
    </WorkspaceShell>
  )
}
