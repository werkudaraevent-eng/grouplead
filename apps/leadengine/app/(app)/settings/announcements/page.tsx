import Link from "next/link"
import { requirePermission } from "@/lib/require-permission"
import { listAnnouncements } from "@/lib/announcements/announcement-queries"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import { pageIntroKey } from "@/lib/hints/hint-key"
import { AnnouncementList } from "@/features/announcements/components/announcement-list"

export const dynamic = "force-dynamic"

const CONTAINER = "w-full max-w-[1200px]"

/**
 * Settings → Announcements: the panel a product team would have for in-app
 * announcements. What the code can announce is listed here (a changelog
 * entry with an `announcement` block); an admin decides whether each one is
 * on and can announce it again after a training. Content is not edited
 * here; it ships with the feature. The layout already requires
 * settings.read; changing a switch needs settings.update, checked here and
 * again in the actions.
 */
export default async function AnnouncementSettingsPage() {
  const guard = await requirePermission("settings", "update")
  const announcements = guard.allowed ? await listAnnouncements() : null

  return (
    // Fluid on a phone: opts out of the shell's 900px canvas (main-layout.tsx).
    <div data-fluid-page className="min-h-[100dvh] bg-background">
      <SettingsPageHeader
        title="Announcements"
        subtitle="New features, announced once per person."
        intro={pageIntroKey("settings-announcements")}
        breadcrumbs={[{ label: "Announcements" }]}
      />

      <div className="px-4 sm:px-6 lg:px-8 pb-20">
        <div className={CONTAINER}>
          {announcements ? (
            <>
              <div className="mb-4 space-y-2 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-4 text-sm leading-relaxed text-muted-foreground sm:px-5">
                <p>
                  Each person sees the What&apos;s new dialog once, when they open the dashboard, and can choose Later. An announcement
                  that is off shows to nobody; turning one back on does not repeat it for people who already closed it.{" "}
                  <strong className="font-medium text-foreground">Announce again</strong> shows the dialog once more to every account,
                  for example after a training.
                </p>
                <p>
                  The content ships with the feature and is recorded in the{" "}
                  <Link href="/changelog" className="font-medium text-foreground underline underline-offset-2">
                    Changelog
                  </Link>
                  ; this page only decides which releases are announced.
                </p>
              </div>
              <AnnouncementList items={announcements} />
            </>
          ) : (
            <div className="mt-2 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
              You do not have permission to manage announcements.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
