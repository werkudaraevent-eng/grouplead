import { redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listNotifications } from "@/lib/notifications/notification-queries"
import { WorkspacePage } from "@/app/workspace/workspace-page"
import { pageIntroKey } from "@/lib/hints/hint-key"
import { NotificationList } from "./notification-list"

export const dynamic = "force-dynamic"

export default async function NotificationsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const notifications = await listNotifications(access)

  return (
    <WorkspacePage
      introKey={pageIntroKey("notifications")}
      title="Notifikasi"
      description="Penugasan, jawaban tim, permintaan jadwal ulang, dan laporan yang masuk."
    >
      <NotificationList notifications={notifications} />
    </WorkspacePage>
  )
}
