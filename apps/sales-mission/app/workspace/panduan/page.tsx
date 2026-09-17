import Link from "next/link"
import { redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { resolveNavAccess } from "@/lib/missions/nav-access"
import { WorkspacePage } from "@/app/workspace/workspace-page"
import { BarChart3, CalendarDays, ClipboardList, Download, LayoutDashboard, ShieldCheck, UserSearch } from "@/components/icons"
import { paths } from "@/lib/paths"
import { PRODUCT_NAME } from "@/lib/brand"

export const dynamic = "force-dynamic"

/**
 * The guide: five short parts, one per thing a person does here, each
 * ending in the link that does it. Not a tour and not a manual: the
 * empty states and coach marks teach at the moment of need, and this is
 * where their "Pelajari" links land. Static, so it costs nothing and
 * never lags behind a deploy.
 */

interface Part {
  id: string
  icon: typeof LayoutDashboard
  title: string
  lead: string
  points: string[]
  link?: { href: string; label: string }
}

const PARTS: Part[] = [
  {
    id: "hari-ini",
    icon: LayoutDashboard,
    title: "Hari ini",
    lead: "Halaman pertama setiap hari: kunjungan hari ini, laporan yang masih ditunggu, prospek yang harus dihubungi lagi, dan penugasan yang menunggu jawabanmu.",
    points: [
      "Kunjungan hari ini tampil sebagai kartu; ketuk kartunya untuk membuka detail.",
      "Laporan tertunda adalah kunjungan yang sudah lewat tetapi laporannya belum dikirim.",
      "Penugasan yang menunggu jawaban punya tombol Terima; Tolak dan usul jadwal lain ada di menu di sampingnya.",
    ],
    link: { href: paths.workspace, label: "Buka Hari ini" },
  },
  {
    id: "aktivitas",
    icon: ClipboardList,
    title: "Aktivitas dan tim",
    lead: "Satu aktivitas adalah satu kunjungan ke satu klien: siapa yang pergi, kapan, ke mana, dan untuk apa.",
    points: [
      "Aktivitas baru: pilih klien (dari prospek atau CRM), industri, jenis, jadwal, lokasi, dan sales utama. Industri terisi sendiri dari prospek atau perusahaan CRM yang dipilih, dan ikut tercatat di LeadEngine saat perusahaan baru didaftarkan. Pemilih jadwal memperlihatkan kalender tim supaya jam yang dipilih tidak bentrok.",
      "Membatalkan: pilih Batal bila tidak ada lanjutan, atau Ditunda, jadwal menyusul bila klien minta hari lain dan tanggalnya belum ada. Yang ditunda muncul di Hari ini pada Perlu dijadwalkan ulang sampai Anda menekan Jadwalkan lagi.",
      "Sales utama adalah yang menulis laporan. Sales pendukung boleh Join sendiri selama kuota pendukung belum penuh dan pemilik mengizinkan.",
      "Bila konfirmasi penugasan diaktifkan, orang yang ditugaskan menjawab Terima atau Tolak, atau mengusulkan jadwal lain.",
      "Kalender dan Papan live memperlihatkan hal yang sama dari sudut waktu dan dari sudut tim. Di Kalender, chip Semua dan Saya serta pilihan Sales menyaring siapa yang digambar; pilihan terakhir diingat per orang.",
    ],
    link: { href: paths.activities(), label: "Buka daftar aktivitas" },
  },
  {
    id: "laporan",
    icon: BarChart3,
    title: "Laporan kunjungan",
    lead: "Setelah kunjungan, sales utama mengisi apa yang terjadi: hasil, tingkat minat, kebutuhan klien, kontak yang ditemui, foto, dan tindak lanjut.",
    points: [
      "Laporan baru bisa diisi pada hari kunjungannya (mulai 00.00), dan waktu kunjungan yang diisi tidak boleh di masa depan. Kunjungan yang dimajukan: pindahkan jadwalnya dulu. Admin bisa mematikan aturan ini di Pengaturan → Aktivitas.",
      "Draf tersimpan otomatis setiap perubahan; tutup dan lanjutkan kapan saja dari halaman aktivitas.",
      "Kirim laporan ketika sudah lengkap. Setelah dikirim, atasan bisa membacanya, dan perubahan tercatat sebagai versi.",
      "Salah kirim? Tarik kembali: laporan kembali menjadi draf dengan isi yang sama, aktivitas tidak lagi Selesai, versi terkirim dan alasannya tersimpan, tim diberi tahu. Boleh dilakukan penulisnya selama jendela ubah laporan, dan atasan yang berwenang kapan saja. Lead yang sudah dikirim ke LeadEngine tetap ada di sana. Laporan uji coba: tarik kembali lalu buang drafnya.",
      "Laporan yang menandai peluang bisa dikirim ke LeadEngine sebagai lead, satu kali per aktivitas. Saat mengirim, pilih kategori lead (HQL, Hot, Warm, Cold, sesuai Master Options LeadEngine); tingkat minat di laporan menyarankan salah satunya, dan ringkasan tampil dulu sebelum dikirim.",
      "Halaman Laporan mengumpulkan semua laporan yang boleh kamu lihat; Ringkasan menghitungnya.",
    ],
    link: { href: paths.reports, label: "Buka Laporan" },
  },
  {
    id: "prospek",
    icon: UserSearch,
    title: "Prospek",
    lead: "Daftar calon klien yang sedang dihubungi, sebelum ada janji temu.",
    points: [
      "Impor dari Excel atau tambah satu per satu; setiap prospek punya pemegang, status, dan tanggal hubungi lagi.",
      "Catat setiap kontak (telepon, WhatsApp, email). Tanggal hubungi lagi yang jatuh tempo muncul di Hari ini.",
      "Begitu janji temu jadi, jadwalkan aktivitas langsung dari prospeknya; data klien dan kontak ikut terisi.",
      "Setelah punya aktivitas, status prospek mengikuti nasib aktivitasnya: Rescheduled bila jadwalnya pernah dipindah, Completed bila kunjungannya selesai, Cancelled bila dibatalkan; selain itu tetap Confirmed. Prospek yang aktivitasnya ditunda lalu dijadwalkan lagi ikut pindah ke aktivitas barunya.",
    ],
    link: { href: paths.prospects, label: "Buka Prospek" },
  },
  {
    id: "izin",
    icon: ShieldCheck,
    title: "Siapa boleh apa",
    lead: "Yang tampil dan yang bisa diubah mengikuti peranmu, diatur admin di Role & Izin (LeadEngine).",
    points: [
      "Cakupan lihat menentukan catatan siapa yang muncul di daftar: milik sendiri, tim (bawahan langsung menurut Atasan), atau semua.",
      "Cakupan ubah menentukan catatan siapa yang boleh diubah, dan tidak pernah lebih lebar dari cakupan lihat.",
      "Bila sebuah tombol tidak ada atau ditolak, pesannya menyebut cakupan yang membatasinya. Minta admin bila memang perlu dilebarkan.",
    ],
  },
]

export default async function GuidePage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  const navAccess = await resolveNavAccess(access)
  const parts = PARTS.filter((part) => {
    if (part.id === "aktivitas") return navAccess.missions
    if (part.id === "laporan") return navAccess.reports
    if (part.id === "prospek") return navAccess.prospects
    return true
  })

  return (
    <WorkspacePage
      eyebrow={`${PRODUCT_NAME} / Panduan`}
      title="Panduan"
      description={`Cara kerja ${PRODUCT_NAME} dalam beberapa bagian pendek.`}
    >
      <nav aria-label="Bagian panduan" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {parts.map((part) => (
          <a
            key={part.id}
            href={`#${part.id}`}
            className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-lg border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            {part.title}
          </a>
        ))}
        <a href="#pasang" className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-lg border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted">
          Di ponsel
        </a>
      </nav>

      <div className="max-w-3xl space-y-4">
        {parts.map((part) => (
          <section key={part.id} id={part.id} aria-labelledby={`guide-${part.id}`} className="scroll-mt-16 overflow-hidden rounded-xl border bg-card lg:scroll-mt-4">
            <header className="flex items-start gap-4 border-b px-5 py-4 sm:px-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <part.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 id={`guide-${part.id}`} className="text-base font-semibold text-foreground">{part.title}</h2>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{part.lead}</p>
              </div>
            </header>
            <ul className="space-y-3 px-5 py-4 sm:px-6">
              {part.points.map((point, index) => (
                <li key={index} className="flex items-start gap-3 text-sm leading-relaxed text-foreground">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{index + 1}</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            {part.link && (
              <div className="border-t bg-muted/30 px-5 py-3 sm:px-6">
                <Link href={part.link.href} className="inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline">
                  {part.link.label}
                </Link>
              </div>
            )}
          </section>
        ))}

        <section id="pasang" aria-labelledby="guide-pasang" className="scroll-mt-16 overflow-hidden rounded-xl border bg-card lg:scroll-mt-4">
          <header className="flex items-start gap-4 border-b px-5 py-4 sm:px-6">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Download className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="guide-pasang" className="text-base font-semibold text-foreground">Di ponsel</h2>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                {PRODUCT_NAME} bisa dipasang ke layar utama dan dibuka seperti aplikasi: tanpa bilah alamat, dengan ikon sendiri. Kalender, Papan live, Notifikasi, Pengaturan, dan Panduan ada di menu Lainnya di bilah bawah.
              </p>
            </div>
          </header>
          <ul className="space-y-3 px-5 py-4 sm:px-6">
            <li className="flex items-start gap-3 text-sm leading-relaxed text-foreground">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">1</span>
              <span>Jadwal kunjungan Anda bisa ikut ke Google Calendar, Kalender iPhone, atau Outlook lewat satu tautan langganan dari <strong>Kalender saya</strong>; pengingat mengikuti kalender ponsel. Satu arah: ubah jadwal di Sales Activity, bukan di kalender.</span>
            </li>
            <li className="flex items-start gap-3 text-sm leading-relaxed text-foreground">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">2</span>
              <span>Di daftar Aktivitas, chip <strong>Hari ini</strong>, <strong>Minggu ini</strong>, dan <strong>Saya</strong> menyaring satu ketukan, dan pilihan terakhir diingat sampai Anda mengubahnya.</span>
            </li>
          </ul>
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t bg-muted/30 px-5 py-3 sm:px-6">
            <Link href={paths.install} className="inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline">
              Cara memasang di Android dan iPhone
            </Link>
            <Link href={paths.myCalendar} className="inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline">
              Kalender saya
            </Link>
            <Link href={paths.whatsNew} className="inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline">
              Yang baru di aplikasi
            </Link>
          </div>
        </section>

        <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
          <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Istilah yang dipakai: aktivitas = satu kunjungan terjadwal; sales utama = yang memimpin dan menulis laporan; sales pendukung = yang ikut; prospek = calon klien sebelum ada janji temu.
        </p>
      </div>
    </WorkspacePage>
  )
}
