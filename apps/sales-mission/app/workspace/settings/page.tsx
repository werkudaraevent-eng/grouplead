import Link from "next/link"
import { redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { ArrowUpRight, Bell, Building2, Database, History, ListChecks, MonitorPlay, ShieldCheck } from "lucide-react"
import { WorkspacePage } from "@/app/workspace/workspace-page"

const SETTING_CARDS = [
  {
    icon: ListChecks,
    tone: "bg-primary/10 text-primary",
    title: "Form mission",
    description: "Tambah, ubah, urutkan, dan tentukan field wajib pada form buat mission.",
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
    icon: MonitorPlay,
    tone: "bg-[var(--success)] text-[var(--success-foreground)]",
    title: "Papan live",
    description: "Tautan papan untuk layar kantor, dan tampilan internal untuk tim.",
    href: "/workspace/settings/board",
  },
  {
    icon: Building2,
    tone: "bg-primary/10 text-primary",
    title: "Aturan mission",
    description: "Apakah sales harus mengonfirmasi penugasan, batas sales pendukung, dan pemeriksaan bentrok jadwal.",
    href: "/workspace/settings/missions",
  },
  {
    icon: History,
    tone: "bg-primary/10 text-primary",
    title: "Riwayat aktivitas",
    description: "Siapa membuat, mengubah, dan menghapus apa, dengan isi perubahannya. Dicatat otomatis untuk setiap perubahan.",
    href: "/workspace/settings/activity",
  },
  {
    icon: Database,
    tone: "bg-[var(--danger)] text-[var(--danger-foreground)]",
    title: "Data",
    description: "Kosongkan seluruh mission unit bisnis ini, misalnya setelah masa uji coba.",
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
    description: "Sales Mission access is managed through LeadEngine permissions.",
  },
]

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_settings")

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Administration"
      title="Settings"
      description="Configure how missions are planned, assigned, and communicated across your team."
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
