"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCheck, Loader2 } from "@/components/icons"
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/notification-actions"
import type { NotificationRow } from "@/lib/notifications/notification-queries"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { paths } from "@/lib/paths"

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: MISSION_TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function NotificationList({ notifications }: { notifications: NotificationRow[] }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  const unread = notifications.filter((item) => item.readAt === null).length

  const markAll = () => {
    start(async () => {
      const result = await markAllNotificationsRead()
      if (result.success) router.refresh()
      else toast.error(result.error ?? "Gagal menandai notifikasi")
    })
  }

  // Opening a notification is what "reading" means, so the mark happens on the
  // way out rather than needing a separate button per row.
  const open = (notification: NotificationRow) => {
    if (notification.readAt === null) {
      start(async () => {
        await markNotificationRead(notification.id)
        router.refresh()
      })
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Kotak masuk</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            {unread > 0 ? `${unread} belum dibaca` : "Semua sudah dibaca"}
          </h2>
        </div>
        {unread > 0 && (
          <Button size="sm" variant="outline" onClick={markAll} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
            Tandai semua
          </Button>
        )}
      </div>

      {notifications.length > 0 ? (
        <ul className="divide-y">
          {notifications.map((notification) => {
            const content = (
              <>
                <span className="mt-1.5 shrink-0">
                  <span
                    className={cn(
                      "block h-2 w-2 rounded-full",
                      notification.readAt === null ? "bg-primary" : "bg-transparent"
                    )}
                    aria-hidden="true"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm text-foreground",
                      notification.readAt === null ? "font-semibold" : "font-medium"
                    )}
                  >
                    {notification.title}
                  </span>
                  {notification.body && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{notification.body}</span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {formatWhen(notification.createdAt)}
                </span>
              </>
            )

            return (
              <li key={notification.id}>
                {notification.missionId ? (
                  <Link
                    href={paths.activity(notification.missionId)}
                    onClick={() => open(notification)}
                    className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/50"
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => open(notification)}
                    className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50"
                  >
                    {content}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          Belum ada notifikasi. Kamu akan diberi tahu saat ada penugasan, jawaban tim, atau laporan masuk.
        </p>
      )}
    </div>
  )
}
