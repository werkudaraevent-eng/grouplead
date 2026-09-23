import Link from "next/link"
import { redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { Activity, ArrowUpRight, Bell, Building2, ClipboardList, Database, History, ListChecks, Megaphone, MonitorPlay, ShieldCheck, Sparkles, Trash2, UserSearch } from "@/components/icons"
import { WorkspacePage } from "@/app/workspace/workspace-page"
import { paths } from "@/lib/paths"

const SETTING_CARDS = [
  {
    icon: ListChecks,
    tone: "bg-primary/10 text-primary",
    title: "Form aktivitas",
    description: "Tambah, ubah, urutkan, dan tentukan field wajib pada form buat aktivitas.",
    href: "/workspace/settings/form",
  },
  {
    icon: ListChecks,
    tone: "bg-[var(--success)] text-[var(--success-foreground)]",
    title: "Form laporan",
    description: "Pertanyaan pada laporan kunjungan: tambah, urutkan, wajibkan, dan atur pilihan jawabannya.",
    href: "/workspace/settings/report-form",
  },
  {
    icon: ListChecks,
    tone: "bg-primary/10 text-primary",
    title: "Form prospek",
    description: "Field pada form prospek dan kolom template impornya: tambah, urutkan, wajibkan.",
    href: "/workspace/settings/prospect-form",
  },
  {
    icon: MonitorPlay,
    tone: "bg-[var(--success)] text-[var(--success-foreground)]",
    title: "Tautan publik",
    description: "Tautan layar TV dan kalender manajemen: lihat yang aktif, cabut yang tidak dipakai.",
    href: "/workspace/settings/board",
  },
  {
    icon: Building2,
    tone: "bg-primary/10 text-primary",
    title: "Aturan aktivitas",
    description: "Apakah sales harus mengonfirmasi penugasan, batas sales pendukung, dan pemeriksaan bentrok jadwal.",
    href: paths.settings.activities,
  },
  {
    icon: Sparkles,
    tone: "bg-[var(--tonal)] text-[var(--tonal-foreground)]",
    title: "AI",
    description: "Endpoint proxy, kunci API, dan model untuk fitur AI. Satu koneksi dipakai Sales Activity dan LeadEngine.",
    href: paths.settings.ai,
  },
  {
    icon: Megaphone,
    tone: "bg-[var(--tonal)] text-[var(--tonal-foreground)]",
    title: "Pengumuman",
    description: "Fitur baru mana yang diumumkan lewat dialog Yang baru saat orang membuka Hari ini, dan umumkan ulang setelah training.",
    href: paths.settings.announcements,
  },
  {
    icon: History,
    tone: "bg-primary/10 text-primary",
    title: "Riwayat perubahan",
    description: "Siapa membuat, mengubah, dan menghapus apa, dengan isi perubahannya. Dicatat otomatis untuk setiap perubahan.",
    href: paths.settings.history,
  },
  {
    icon: Activity,
    tone: "bg-primary/10 text-primary",
    title: "Pemakaian",
    description: "Siapa yang membuka aplikasi dan kapan terakhir, berapa hari aktif, dan halaman yang paling sering dibuka.",
    href: paths.settings.usage(),
  },
  {
    icon: ClipboardList,
    tone: "bg-primary/10 text-primary",
    title: "Tindak lanjut",
    description: "Pilihan cara dan hasil saat sales mencatat tindak lanjut dari laporan. Jenis di baliknya tetap.",
    href: "/workspace/settings/follow-up",
  },
  {
    icon: UserSearch,
    tone: "bg-primary/10 text-primary",
    title: "Status prospek",
    description: "Nama, warna, dan urutan status prospek. Tambah tahap sendiri; jenis di baliknya tetap.",
    href: "/workspace/settings/prospect-statuses",
  },
  {
    icon: Trash2,
    tone: "bg-muted text-muted-foreground",
    title: "Sampah",
    description: "Aktivitas dan prospek yang dihapus tinggal di sini 30 hari. Pulihkan, atau hapus permanen.",
    href: "/workspace/settings/recycle-bin",
  },
  {
    icon: Database,
    tone: "bg-[var(--danger)] text-[var(--danger-foreground)]",
    title: "Data",
    description: "Kosongkan seluruh aktivitas unit bisnis ini, misalnya setelah masa uji coba.",
    href: "/workspace/settings/data",
  },
  {
    icon: Bell,
    tone: "bg-[var(--warning)] text-[var(--warning-foreground)]",
    title: "Notifications",
    description: "Assignment reminders and reschedule request alerts.",
  },
  {
    icon: ShieldCheck,
    tone: "bg-[var(--success)] text-[var(--success-foreground)]",
    title: "Access",
    description: "Sales Activity access is managed through LeadEngine permissions.",
  },
]

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_settings")

  return (
    <WorkspacePage
      eyebrow="Sales Activity / Administration"
      title="Settings"
      description="Configure how aktivitas are planned, assigned, and communicated across your team."
    >
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SETTING_CARDS.map((card) => {
          const body = (
            <>
              <span className={`grid h-9 w-9 place-items-center rounded-lg ${card.tone}`}>
                <card.icon className="h-[17px] w-[17px]" />
              </span>
              <h2 className="mt-4 flex items-center gap-1.5 text-base font-semibold text-foreground">
                {card.title}
                {card.href && <ArrowUpRight className="h-4 w-4 text-muted-foreground" />}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
              {/* Cards without a destination say so. An enabled control that
                  ignores clicks reads as broken rather than unbuilt. */}
              {!card.href && (
                <p className="mt-4 inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Belum tersedia
                </p>
              )}
            </>
          )

          return card.href ? (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              {body}
            </Link>
          ) : (
            <article key={card.title} className="rounded-xl border bg-card p-5">{body}</article>
          )
        })}
      </section>
    </WorkspacePage>
  )
}
