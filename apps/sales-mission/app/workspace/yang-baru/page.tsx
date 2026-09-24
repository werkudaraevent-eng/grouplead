import { redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { WorkspacePage } from "@/app/workspace/workspace-page"
import { pageIntroKey } from "@/lib/hints/hint-key"
import { CHANGELOG, CHANGE_KIND_LABELS, type ChangeKind } from "@/lib/changelog"
import { listAnnouncements } from "@/lib/announcements/announcement-queries"
import { MarkAnnouncementsRead } from "@/components/announcements/announcement-dialog"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { PRODUCT_NAME } from "@/lib/brand"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

/**
 * Yang baru: the product's release notes, for everyone who uses it (a
 * rep learns about a new chip here as much as an admin does). A timeline
 * of dated entries; each item is one plain sentence with a tonal label
 * saying whether it is new, better, or fixed.
 */

const KIND_TONE: Record<ChangeKind, string> = {
  baru: "bg-primary/10 text-primary",
  "lebih-baik": "bg-secondary text-secondary-foreground",
  diperbaiki: "bg-[var(--success)] text-[var(--success-foreground)]",
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "long", year: "numeric" }).format(new Date(`${iso}T00:00:00+07:00`))

export default async function WhatsNewPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  const announcements = await listAnnouncements(access)

  return (
    <WorkspacePage introKey={pageIntroKey("whats-new")} title="Yang baru" description={`Perubahan di ${PRODUCT_NAME}, dari yang terbaru.`}>
      {/* Opening the page is reading: the dot on the menu clears for every announcement that is on. */}
      <MarkAnnouncementsRead readKeys={announcements.filter((item) => item.enabled).map((item) => item.readKey)} />
      <ol className="relative max-w-3xl space-y-8 border-l border-border pl-6 lg:pl-8">
        {CHANGELOG.map((entry, index) => (
          <li key={`${entry.date}-${index}`} className="relative">
            <span aria-hidden="true" className="absolute -left-[calc(1.5rem+5px)] top-2 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background lg:-left-[calc(2rem+5px)]" />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-base font-semibold text-foreground">{entry.title}</h2>
              <time dateTime={entry.date} className="text-sm text-muted-foreground">{formatDate(entry.date)}</time>
            </div>
            <ul className="mt-3 space-y-2">
              {entry.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3">
                  <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", KIND_TONE[item.kind])}>{CHANGE_KIND_LABELS[item.kind]}</span>
                  <p className="text-sm leading-relaxed text-foreground">{item.text}</p>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </WorkspacePage>
  )
}
