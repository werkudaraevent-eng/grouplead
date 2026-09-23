import Link from "next/link"
import { redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import {
  Activity,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  Database,
  ExternalLink,
  FileText,
  History,
  Megaphone,
  MonitorPlay,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Trash2,
  UserSearch,
  type IconComponent,
} from "@/components/icons"
import { WorkspacePage } from "@/app/workspace/workspace-page"
import { paths } from "@/lib/paths"

type SettingItem = {
  icon: IconComponent
  title: string
  description: string
  href: string
}

type SettingSection = {
  label: string
  description: string
  items: SettingItem[]
}

/**
 * The settings index is a list of destinations, so it is an M3 list: grouped
 * under subheaders, one two-line item per page (leading icon, headline,
 * supporting text, trailing chevron), read top to bottom. Only pages that
 * exist are listed; what is not built yet is not advertised here.
 */
const SECTIONS: SettingSection[] = [
  {
    label: "Form",
    description: "Isi form yang dipakai sales saat membuat aktivitas, laporan, dan prospek.",
    items: [
      {
        icon: CalendarCheck,
        title: "Form aktivitas",
        description: "Tambah, ubah, urutkan, dan tentukan field wajib pada form buat aktivitas.",
        href: "/workspace/settings/form",
      },
      {
        icon: FileText,
        title: "Form laporan",
        description: "Pertanyaan pada laporan kunjungan: tambah, urutkan, wajibkan, dan atur pilihan jawabannya.",
        href: "/workspace/settings/report-form",
      },
      {
        icon: UserSearch,
        title: "Form prospek",
        description: "Field pada form prospek dan kolom template impornya: tambah, urutkan, wajibkan.",
        href: "/workspace/settings/prospect-form",
      },
    ],
  },
  {
    label: "Alur kerja",
    description: "Aturan penugasan, tindak lanjut, dan tahap prospek.",
    items: [
      {
        icon: SlidersHorizontal,
        title: "Aturan aktivitas",
        description: "Apakah sales harus mengonfirmasi penugasan, batas sales pendukung, dan pemeriksaan bentrok jadwal.",
        href: paths.settings.activities,
      },
      {
        icon: ClipboardList,
        title: "Tindak lanjut",
        description: "Pilihan cara dan hasil saat sales mencatat tindak lanjut dari laporan. Jenis di baliknya tetap.",
        href: paths.settings.followUp,
      },
      {
        icon: Tags,
        title: "Status prospek",
        description: "Nama, warna, dan urutan status prospek. Tambah tahap sendiri; jenis di baliknya tetap.",
        href: "/workspace/settings/prospect-statuses",
      },
    ],
  },
  {
    label: "Komunikasi",
    description: "Apa yang diumumkan ke tim dan apa yang dibagikan ke luar aplikasi.",
    items: [
      {
        icon: Megaphone,
        title: "Pengumuman",
        description: "Fitur baru mana yang diumumkan lewat dialog Yang baru saat orang membuka Hari ini, dan umumkan ulang setelah training.",
        href: paths.settings.announcements,
      },
      {
        icon: MonitorPlay,
        title: "Tautan publik",
        description: "Tautan layar TV dan kalender manajemen: lihat yang aktif, cabut yang tidak dipakai.",
        href: paths.settings.board,
      },
    ],
  },
  {
    label: "Pemantauan",
    description: "Siapa mengubah apa, dan siapa yang benar-benar memakai aplikasi.",
    items: [
      {
        icon: History,
        title: "Riwayat perubahan",
        description: "Siapa membuat, mengubah, dan menghapus apa, dengan isi perubahannya. Dicatat otomatis untuk setiap perubahan.",
        href: paths.settings.history,
      },
      {
        icon: Activity,
        title: "Pemakaian",
        description: "Siapa yang membuka aplikasi dan kapan terakhir, berapa hari aktif, dan halaman yang paling sering dibuka.",
        href: paths.settings.usage(),
      },
    ],
  },
  {
    label: "Sistem",
    description: "Koneksi AI dan data yang dihapus.",
    items: [
      {
        icon: Sparkles,
        title: "AI",
        description: "Endpoint proxy, kunci API, dan model untuk fitur AI. Satu koneksi dipakai Sales Activity dan LeadEngine.",
        href: paths.settings.ai,
      },
      {
        icon: Trash2,
        title: "Sampah",
        description: "Aktivitas dan prospek yang dihapus tinggal di sini 30 hari. Pulihkan, atau hapus permanen.",
        href: "/workspace/settings/recycle-bin",
      },
      {
        icon: Database,
        title: "Data",
        description: "Kosongkan seluruh aktivitas unit bisnis ini, misalnya setelah masa uji coba.",
        href: "/workspace/settings/data",
      },
    ],
  },
]

const leadEngineUrl = process.env.NEXT_PUBLIC_LEADENGINE_URL?.trim() || null

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_settings")

  return (
    <WorkspacePage
      eyebrow="Sales Activity / Administrasi"
      title="Pengaturan"
      description="Atur bagaimana aktivitas direncanakan, ditugaskan, dan dikomunikasikan ke tim."
    >
      <div className="max-w-4xl">
        {SECTIONS.map((section) => (
          <section key={section.label} aria-labelledby={`settings-${section.label}`} className="mt-8 first:mt-2">
            <div className="px-1">
              <h2 id={`settings-${section.label}`} className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {section.label}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
            </div>
            <ul className="mt-3 divide-y overflow-clip rounded-xl border bg-card">
              {section.items.map((item) => (
                <li key={item.href}>
                  <SettingRow item={item} />
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* Who may open Sales Activity is not a setting here: the role
            matrix lives in LeadEngine, and the link leaves this app, so it
            carries the external-link mark the rows above do not. */}
        <p className="mt-8 px-1 text-sm text-muted-foreground">
          Siapa boleh membuka Sales Activity dan apa yang boleh dilakukannya diatur di LeadEngine, pada Settings → Roles &amp; permissions.
          {leadEngineUrl && (
            <>
              {" "}
              <a
                href={`${leadEngineUrl.replace(/\/$/, "")}/settings/permissions`}
                className="inline-flex min-h-8 items-center gap-1 font-semibold text-primary hover:underline"
              >
                Buka di LeadEngine <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </>
          )}
        </p>
      </div>
    </WorkspacePage>
  )
}

function SettingRow({ item }: { item: SettingItem }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className="group flex min-h-[72px] items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-muted/60 sm:px-5"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{item.title}</span>
        <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted-foreground">{item.description}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  )
}
