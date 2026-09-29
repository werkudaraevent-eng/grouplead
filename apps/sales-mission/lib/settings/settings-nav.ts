/**
 * Pengaturan's places, and who sees which: one list read by the settings
 * menu beside every settings page on a desk (`SettingsFrame`) and by the
 * Pengaturan page itself, the list a phone opens, so the two can never
 * disagree about what a person may open (DESIGN.md "Settings layout and
 * page width").
 *
 * Akun is everyone's: a rep who may open no other setting still reaches
 * Profil and Perangkat aktif, and sees only that group. The other groups
 * are the Pengaturan grant's, as they have always been. Hiding a row is
 * presentation only; every page checks its own grant on the server.
 *
 * Pure on purpose: no icons, no React. The components map each item's
 * `icon` to its glyph.
 */

import { paths } from "@/lib/paths"

export type SettingsIconKey =
  | "profile"
  | "devices"
  | "activity-form"
  | "report-form"
  | "prospect-form"
  | "activity-rules"
  | "follow-up"
  | "prospect-statuses"
  | "announcements"
  | "public-links"
  | "history"
  | "usage"
  | "ai"
  | "recycle-bin"
  | "data"

export interface SettingsItem {
  href: string
  title: string
  /** The supporting line under the title on the Pengaturan page. */
  description: string
  icon: SettingsIconKey
}

export interface SettingsGroup {
  id: string
  label: string
  description: string
  items: SettingsItem[]
  /** Shown to every signed-in person, whatever their role (Akun). */
  everyone?: boolean
}

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    id: "akun",
    label: "Akun",
    description: "Profilmu dan perangkat tempat akunmu sedang masuk.",
    everyone: true,
    items: [
      {
        icon: "profile",
        title: "Profil",
        description: "Nama, foto, nomor telepon, jabatan, dan kata sandi. Satu profil untuk Sales Activity dan LeadEngine.",
        href: paths.settings.profile,
      },
      {
        icon: "devices",
        title: "Perangkat aktif",
        description: "Tempat akunmu sedang masuk. Keluarkan perangkat yang tidak kamu kenal.",
        href: paths.settings.devices,
      },
    ],
  },
  {
    id: "form",
    label: "Form",
    description: "Isi form yang dipakai sales saat membuat aktivitas, laporan, dan prospek.",
    items: [
      {
        icon: "activity-form",
        title: "Form aktivitas",
        description: "Tambah, ubah, urutkan, dan tentukan field wajib pada form buat aktivitas.",
        href: paths.settings.form,
      },
      {
        icon: "report-form",
        title: "Form laporan",
        description: "Pertanyaan pada laporan kunjungan: tambah, urutkan, wajibkan, dan atur pilihan jawabannya.",
        href: paths.settings.reportForm,
      },
      {
        icon: "prospect-form",
        title: "Form prospek",
        description: "Field pada form prospek dan kolom template impornya: tambah, urutkan, wajibkan.",
        href: paths.settings.prospectForm,
      },
    ],
  },
  {
    id: "alur-kerja",
    label: "Alur kerja",
    description: "Aturan penugasan, tindak lanjut, dan tahap prospek.",
    items: [
      {
        icon: "activity-rules",
        title: "Aturan aktivitas",
        description: "Apakah sales harus mengonfirmasi penugasan, batas sales pendukung, dan pemeriksaan bentrok jadwal.",
        href: paths.settings.activities,
      },
      {
        icon: "follow-up",
        title: "Tindak lanjut",
        description: "Pilihan cara dan hasil saat sales mencatat tindak lanjut dari laporan. Jenis di baliknya tetap.",
        href: paths.settings.followUp,
      },
      {
        icon: "prospect-statuses",
        title: "Status prospek",
        description: "Nama, warna, dan urutan status prospek. Tambah tahap sendiri; jenis di baliknya tetap.",
        href: paths.settings.prospectStatuses,
      },
    ],
  },
  {
    id: "komunikasi",
    label: "Komunikasi",
    description: "Apa yang diumumkan ke tim dan apa yang dibagikan ke luar aplikasi.",
    items: [
      {
        icon: "announcements",
        title: "Pengumuman",
        description: "Fitur baru mana yang diumumkan lewat dialog Yang baru saat orang membuka Hari ini, dan umumkan ulang setelah training.",
        href: paths.settings.announcements,
      },
      {
        icon: "public-links",
        title: "Tautan publik",
        description: "Tautan layar TV dan kalender manajemen: lihat yang aktif, cabut yang tidak dipakai.",
        href: paths.settings.board,
      },
    ],
  },
  {
    id: "pemantauan",
    label: "Pemantauan",
    description: "Siapa mengubah apa, dan siapa yang benar-benar memakai aplikasi.",
    items: [
      {
        icon: "history",
        title: "Riwayat perubahan",
        description: "Siapa membuat, mengubah, dan menghapus apa, dengan isi perubahannya. Dicatat otomatis untuk setiap perubahan.",
        href: paths.settings.history,
      },
      {
        icon: "usage",
        title: "Pemakaian",
        description: "Siapa yang membuka aplikasi dan kapan terakhir, berapa hari aktif, dan halaman yang paling sering dibuka.",
        href: paths.settings.usage(),
      },
    ],
  },
  {
    id: "sistem",
    label: "Sistem",
    description: "Koneksi AI dan data yang dihapus.",
    items: [
      {
        icon: "ai",
        title: "AI",
        description: "Endpoint proxy, kunci API, dan model untuk fitur AI. Satu koneksi dipakai Sales Activity dan LeadEngine.",
        href: paths.settings.ai,
      },
      {
        icon: "recycle-bin",
        title: "Sampah",
        description: "Aktivitas dan prospek yang dihapus tinggal di sini 30 hari. Pulihkan, atau hapus permanen.",
        href: paths.settings.recycleBin,
      },
      {
        icon: "data",
        title: "Data",
        description: "Kosongkan seluruh aktivitas unit bisnis ini, misalnya setelah masa uji coba.",
        href: paths.settings.data,
      },
    ],
  },
]

/**
 * The groups this person sees, in order: Akun always, the rest only with
 * the Pengaturan grant (`sales_mission_settings` read), as the Pengaturan
 * page has always shown them.
 */
export function visibleSettingsGroups(canOpenSettings: boolean, groups: readonly SettingsGroup[] = SETTINGS_GROUPS): SettingsGroup[] {
  return groups.filter((group) => group.everyone || canOpenSettings)
}

function under(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * The menu item the page at `pathname` belongs to: the item itself, or the
 * item a page sits below (Pemakaian AI is AI's). Null on the Pengaturan
 * page, and outside Pengaturan.
 */
export function activeSettingsItem(pathname: string, groups: readonly SettingsGroup[] = SETTINGS_GROUPS): SettingsItem | null {
  let best: SettingsItem | null = null
  for (const group of groups) {
    for (const item of group.items) {
      if (under(pathname, item.href) && (!best || item.href.length > best.href.length)) best = item
    }
  }
  return best
}

/**
 * Where the phone's back arrow goes from a settings page: a page below an
 * item goes back to that item (Pemakaian AI to AI), an item to the
 * Pengaturan list. The list itself, and anything outside Pengaturan, has
 * no back arrow of Pengaturan's.
 */
export function settingsBackHref(pathname: string, groups: readonly SettingsGroup[] = SETTINGS_GROUPS): string | null {
  const index = paths.settings.index
  if (!under(pathname, index) || pathname === index) return null
  const item = activeSettingsItem(pathname, groups)
  if (item && pathname !== item.href) return item.href
  return index
}
