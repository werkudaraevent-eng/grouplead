import { redirect } from "next/navigation"
import Link from "next/link"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listAnnouncements } from "@/lib/announcements/announcement-queries"
import { paths } from "@/lib/paths"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { pageIntroKey } from "@/lib/hints/hint-key"
import { AnnouncementList } from "./announcement-list"

export const dynamic = "force-dynamic"

/**
 * The unit's control over in-app announcements, the panel a product team
 * would have: what the code can announce is listed here, and the admin
 * decides whether each one is on and can announce it again after a
 * training. Content is not edited here; it ships with the feature.
 */
export default async function AnnouncementSettingsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  if (!(await canPerform(access, "sales_mission_settings", "update"))) {
    return (
      <WorkspacePage eyebrow="Pengaturan" title="Pengumuman" action={<BackLink href={paths.settings.index} />}>
        <EmptyState title="Tidak punya izin" description="Pengumuman fitur hanya dapat diatur oleh admin Sales Activity." />
      </WorkspacePage>
    )
  }

  const announcements = await listAnnouncements(access)

  return (
    <WorkspacePage
      introKey={pageIntroKey("settings-announcements")}
      eyebrow="Pengaturan"
      title="Pengumuman"
      description="Fitur baru yang diumumkan lewat dialog Yang baru saat orang membuka Hari ini."
      action={<BackLink href={paths.settings.index} />}
    >
      <div className="mb-4 space-y-2 rounded-xl border border-dashed bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
        <p>
          Setiap orang melihat dialognya sekali, di Hari ini, dan bisa memilih Nanti saja. Yang dimatikan tidak muncul untuk siapa pun;
          yang dinyalakan lagi tidak mengulang untuk yang sudah menutupnya. <strong className="font-medium text-foreground">Umumkan ulang</strong> membuat dialognya
          muncul lagi untuk semua akun, misalnya setelah training.
        </p>
        <p>
          Isi pengumuman ikut dengan fiturnya dan tercatat di <Link href={paths.whatsNew} className="font-medium text-foreground underline underline-offset-2">Yang baru</Link>;
          di sini hanya diputuskan mana yang diumumkan.
        </p>
      </div>
      <AnnouncementList items={announcements} />
    </WorkspacePage>
  )
}
