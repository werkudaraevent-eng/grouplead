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
      "Kalender dan Papan live memperlihatkan hal yang sama dari sudut waktu dan dari sudut tim. Di Kalender, chip Semua dan Saya serta pilihan Sales menyaring siapa yang digambar, pilihan Lokasi dan Jenis menyaring tempat dan jenis kunjungannya, dan tombol kelompokkan di panel hari menyusun daftar per lokasi atau per sales; foto sales ada di ujung tiap baris; pilihan terakhir diingat per orang. Admin bisa membuat tautan jadwal publik dari Kalender: manajemen membukanya di browser tanpa login, baca-saja, dan tautannya bisa dicabut dari Pengaturan → Tautan publik. Papan live untuk TV kantor menyorot kunjungan yang sedang berlangsung, menyusun Tim di lapangan menurut siapa sedang di mana, dan menghitung progres dari yang sudah berlangsung; kunjungan yang jamnya lewat tanpa laporan ditandai Belum dilaporkan, jadi laporkan segera setelah kembali. Saat admin membuat tautan layar ada dua saklar yang terikat ke tautan itu: Tampilkan nama klien dan Tampilkan hasil kunjungan; keduanya hanya untuk layar di ruang tim sendiri, karena nama klien bersama hasil kunjungan adalah pipeline. Saklar ketiga, Sertakan QR ke kalender, menaruh QR kecil di layar menuju Jadwal tim: pindai dengan ponsel untuk mengecek jadwal dengan waktumu sendiri, tanpa login.",
    ],
    link: { href: paths.activities(), label: "Buka daftar aktivitas" },
  },
  {
    id: "laporan",
    icon: BarChart3,
    title: "Laporan kunjungan",
    lead: "Setelah kunjungan, sales utama mengisi apa yang terjadi: hasil, tingkat minat, kebutuhan klien, kontak yang ditemui, foto, rekaman pertemuan, dan tindak lanjut.",
    points: [
      "Laporan baru bisa diisi pada hari kunjungannya (mulai 00.00), dan waktu kunjungan yang diisi tidak boleh di masa depan. Kunjungan yang dimajukan: pindahkan jadwalnya dulu. Admin bisa mematikan aturan ini di Pengaturan → Aktivitas.",
      "Draf tersimpan otomatis setiap perubahan; tutup dan lanjutkan kapan saja dari halaman aktivitas.",
      "Gaya komunikasi (DISC): kalau admin menyalakannya di Pengaturan → Aktivitas, tiap kontak yang ditemui bisa diberi tipe DISC sesuai pelatihan: satu huruf Utama (D Dominance, I Influence, S Steadiness, C Conscientiousness) dan, kalau terlihat, satu huruf Pendamping; ini perkiraanmu setelah bertemu, bukan hasil tes, dan selalu opsional. Pilih hurufnya dan cara menghadapinya muncul sebagai pengingat; tambahkan catatanmu sendiri (misal “minta angka tertulis dulu”). Hasilnya tampil di halaman aktivitas untuk semua anggota unit, ikut ke kontak di LeadEngine, dan terisi otomatis di kunjungan berikutnya ke orang yang sama, dengan nama penilai dan tanggalnya. Tidak pernah tampil di tautan publik atau ekspor.",
      "Rekaman pertemuan: sebelum mulai, beri tahu klien bahwa pertemuan direkam. Rekam dengan Memo Suara (bukan dari browser, karena iPhone menghentikan mikrofon saat layar terkunci), lalu di kartu Lampiran ketuk Unggah rekaman dan pilih berkasnya. Sekali saja, atur Pengaturan iPhone → Memo Suara → Kualitas Audio → Terkompresi: satu jam jadi sekitar 30 MB, sedangkan Lossless 10 MB per menit dan tidak akan muat di batas 50 MB. Format WAV ditolak karena tidak dikompresi; di perekam Android pilih format M4A atau AAC. Rekaman lebih dari 50 MB dipotong dulu di Memo Suara. Yang boleh mendengarkan hanya anggota unit bisnis yang sama; unduh dari halaman aktivitas kalau perlu dianalisis di alat lain.",
      "Kirim laporan ketika sudah lengkap. Setelah dikirim, atasan bisa membacanya, dan perubahan tercatat sebagai versi.",
      "Next action yang kamu tulis di laporan menjadi tindak lanjut yang dilacak: tampil di Hari ini pada Tindak lanjut hari ini sampai kamu mencatat hasilnya. Di kartu laporan, tekan Catat tindak lanjut: lewat apa, hasilnya, kapan, catatan, dan kalau ada, langkah berikutnya, yang langsung dibuka sebagai tindak lanjut baru. Yang boleh mencatat: penanggung jawabnya, sales utama, atau admin. Pilihan cara dan hasilnya diatur admin di Pengaturan → Tindak lanjut.",
      "Setelah laporan dikirim, kamu langsung ditawari Bagikan ke WhatsApp: kartu “Laporan terkirim” di atas laporan, dan di ponsel tombolnya ada di bilah bawah. Teksnya sudah tersusun dalam format grup beserta foto pertama laporan, tinggal pilih grupnya; pilih Nanti saja kalau mau membagikannya kemudian lewat tombol di kartu laporan. Laporan yang sudah dibagikan mencatat siapa dan kapan. Format teksnya dan tawaran ini diatur admin di Pengaturan → Aturan aktivitas → Laporan kunjungan.",
      "Salah kirim? Tarik kembali: laporan kembali menjadi draf dengan isi yang sama, aktivitas tidak lagi Selesai, versi terkirim dan alasannya tersimpan, tim diberi tahu. Boleh dilakukan penulisnya selama jendela ubah laporan, dan atasan yang berwenang kapan saja. Lead yang sudah dikirim ke LeadEngine tetap ada di sana. Laporan uji coba: tarik kembali lalu buang drafnya.",
      "Laporan yang menandai peluang bisa dikirim ke LeadEngine sebagai lead, satu kali per aktivitas. Saat mengirim, pilih kategori lead (HQL, Hot, Warm, Cold, sesuai Master Options LeadEngine); tingkat minat di laporan menyarankan salah satunya, dan ringkasan tampil dulu sebelum dikirim.",
      "Insight hari ini: kalau admin menyalakannya di Pengaturan → Aturan aktivitas, di papan Ringkasan ada kartu berisi 3 sampai 5 kalimat yang ditulis AI dari angka aplikasi: laporan yang masuk hari ini, laporan tertunda, prospek yang lewat tanggal hubungi lagi, dan perbandingan dengan minggu lalu. Dibuat tiap pagi pada jam yang diatur admin dan diperbarui saat ada laporan masuk. Siapa yang melihatnya diatur di Role & Izin, modul Insight AI: cakupan Semua berarti insight unit, Tim atau Sendiri berarti tentang orang dalam cakupanmu. Poin yang bisa dijawab daftar bisa diketuk. Kartu ini selalu tentang hari ini, tidak ikut periode yang disaring, dan bisa dipindah, diubah ukurannya, atau disembunyikan lewat Atur widget seperti kartu lain. AI bisa keliru; angkanya selalu ada di kartu lain untuk dicek.",
      "Tanya AI: kalau admin menyalakannya, di baris saringan Ringkasan ada tombol Tanya AI yang membuka panel samping (di ponsel: lembar dari bawah) untuk bertanya tentang periode dan sales yang sedang disaring (“siapa yang belum ada laporan minggu ini?”). Jawabannya dari angka yang sama dengan kartu-kartu Ringkasan ditambah daftar di baliknya: aktivitas dan laporan pada periode itu, janji temu hari ini dan besok, prospek yang jatuh tempo, dan daftar sales, semuanya dibatasi cakupan lihatmu. Jadi “kunjungan hari ini ke mana saja” atau “siapa yang belum ada laporan” bisa dijawab. Daftar yang panjang dipotong dan AI menyebutkannya. Pertanyaan lanjutan dipahami dalam konteks pertanyaan sebelumnya. Bukan untuk mengubah data; hanya menjawab.",
      "Halaman Laporan mengumpulkan semua laporan yang boleh kamu lihat; Ringkasan menghitungnya sebagai kartu yang bisa disusun: Atur widget untuk menggeser, mengubah ukuran, menyembunyikan, atau membuat kartu sendiri dari ukuran, pengelompokan, dan bentuk grafik. Admin bisa menjadikan susunannya bawaan semua akun lewat menu ⋯. Saringan periode dan sales di atas berlaku untuk semua kartu.",
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
      <nav aria-label="Bagian panduan" className="chip-scroll -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              <span>Jadwal kunjungan Anda bisa ikut ke Google Calendar, Kalender iPhone, atau Outlook lewat satu tautan langganan dari <strong>Kalender saya</strong> (tempel sebagai kalender dari URL, bukan impor berkas). Kalender pribadi berisi aktivitas yang Anda ikuti; atasan dan admin juga mendapat tautan <strong>Kalender tim</strong> berisi semua aktivitas yang boleh mereka lihat; pengingat mengikuti kalender ponsel. Satu arah: ubah jadwal di Sales Activity, bukan di kalender.</span>
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
