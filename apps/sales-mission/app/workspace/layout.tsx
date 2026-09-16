import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { countUnreadNotifications } from "@/lib/notifications/notification-queries"
import { resolveNavAccess } from "@/lib/missions/nav-access"
import { WorkspaceShell } from "./workspace-shell"

export const dynamic = "force-dynamic"

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const [unreadCount, navAccess, cookieStore] = await Promise.all([
    countUnreadNotifications(access),
    resolveNavAccess(access),
    cookies(),
  ])
  // The sidebar's fold is a cookie on the parent domain, so the first HTML
  // already has the width the person left it at, here and in LeadEngine.
  const initialCollapsed = cookieStore.get("sidebar-collapsed")?.value === "true"

  return (
    <WorkspaceShell
      displayName={access.displayName}
      avatarUrl={access.avatarUrl}
      unreadCount={unreadCount}
      navAccess={navAccess}
      companyName={access.companyName}
      initialCollapsed={initialCollapsed}
    >
      {children}
    </WorkspaceShell>
  )
}
