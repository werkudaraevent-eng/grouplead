/**
 * Yang baru: catatan rilis Sales Activity, ditulis untuk sales dan admin,
 * bukan untuk pengembang. Satu sumber untuk halaman /workspace/yang-baru.
 * Tambahkan entri baru di PALING ATAS; bahasa awam, satu kalimat per poin
 * yang menyebut apa yang bisa dilakukan sekarang dan mengapa itu berguna.
 */

export type ChangeKind = "baru" | "lebih-baik" | "diperbaiki"

export interface ChangeItem {
  kind: ChangeKind
  text: string
}

export interface ChangeEntry {
  /** YYYY-MM-DD */
  date: string
  title: string
  items: ChangeItem[]
}

export const CHANGE_KIND_LABELS: Record<ChangeKind, string> = {
  baru: "Baru",
  "lebih-baik": "Lebih baik",
  diperbaiki: "Diperbaiki",
}

export const CHANGELOG: ChangeEntry[] = [
  {
    date: "2026-09-17",
    title: "Ditunda, jadwal menyusul",
    items: [
      { kind: "baru", text: "Laporan kunjungan baru bisa diisi pada hari kunjungannya, dan waktu kunjungan tidak boleh di masa depan; sebelum itu halaman aktivitas menyebut tanggal laporannya terbuka. Admin bisa mematikan aturan ini di Pengaturan → Aktivitas → Laporan hanya setelah kunjungan." },
      { kind: "lebih-baik", text: "Kalender: panel jadwal hari terpilih menggulir sendiri di samping kalender bulan, tidak lagi memanjangkan kartu kalender saat harinya padat." },
      { kind: "diperbaiki", text: "Field telepon: kursor tidak lagi melompat ke belakang saat mengubah angka di tengah nomor, dan Backspace di atas tanda pisah menghapus angka di depannya." },
      { kind: "baru", text: "Saat membatalkan aktivitas, pilih \"Ditunda, jadwal menyusul\" dan tanggal untuk menghubungi klien lagi. Aktivitas itu muncul di Hari ini pada bagian Perlu dijadwalkan ulang sampai Anda menekan Jadwalkan lagi." },
      { kind: "lebih-baik", text: "Aktivitas yang dijadwalkan ulang mencatat tautan ke aktivitas barunya, jadi riwayatnya tidak putus." },
    ],
  },
  {
    date: "2026-09-16",
    title: "Papan live seperti papan keberangkatan",
    items: [
      { kind: "lebih-baik", text: "Papan live di TV kini menaruh jadwal sebagai bagian utama: baris tinggi, jam besar, status sebagai warna tepi, kunjungan yang sedang berjalan disorot di tempatnya. Kotak angka dan jam raksasa dihapus." },
      { kind: "lebih-baik", text: "Tidak ada lagi halaman; daftar yang panjang bergulir sendiri pelan lalu kembali ke atas. Tampilannya sama di TV 1080p maupun 4K." },
    ],
  },
  {
    date: "2026-09-16",
    title: "Industri ikut dari prospek sampai ke CRM",
    items: [
      { kind: "baru", text: "Form aktivitas punya field Industri di samping nama perusahaan. Terisi sendiri dari prospek atau perusahaan CRM yang dipilih, dan tidak menimpa pilihan yang sudah Anda buat." },
      { kind: "baru", text: "Saat laporan mendaftarkan perusahaan baru di LeadEngine, industrinya ikut tercatat di sana." },
      { kind: "lebih-baik", text: "Satu daftar industri untuk prospek dan aktivitas, diatur di Pengaturan → Form prospek." },
    ],
  },
  {
    date: "2026-09-16",
    title: "Kirim ke LeadEngine dengan kategori",
    items: [
      { kind: "baru", text: "Saat mengirim lead, pilih kategori (HQL, Hot, Warm, Cold) dan grade seperti di LeadEngine. Tingkat minat di laporan menyarankan salah satunya." },
      { kind: "baru", text: "Tingkat minat di laporan kunjungan kini punya pilihan HQL." },
      { kind: "lebih-baik", text: "Field yang masih kosong disebut satu per satu dan bisa diketuk, lalu ringkasan lead tampil dulu sebelum dikirim, karena kirim hanya bisa sekali per aktivitas." },
      { kind: "baru", text: "Ringkasan menampilkan lead ke CRM per kategori, siap untuk meeting evaluasi." },
    ],
  },
  {
    date: "2026-09-16",
    title: "Kalender ikut ke ponsel",
    items: [
      { kind: "baru", text: "Kalender saya: satu tautan langganan untuk Google Calendar, Kalender iPhone, atau Outlook. Jadwal kunjungan Anda muncul di kalender ponsel beserta pengingatnya." },
      { kind: "baru", text: "Tambah ke kalender di tiap aktivitas: buka di Google Calendar atau unduh berkas kalender." },
      { kind: "lebih-baik", text: "Tombol Hari ini di Kalender untuk melompat kembali ke bulan dan hari ini." },
    ],
  },
  {
    date: "2026-09-16",
    title: "Saringan cepat yang diingat",
    items: [
      { kind: "baru", text: "Chip Hari ini, Minggu ini, Mendatang, dan Saya di atas daftar Aktivitas: satu ketukan tanpa membuka Filter." },
      { kind: "lebih-baik", text: "Tiap daftar mengingat saringan terakhir Anda. Pindah halaman lalu kembali, saringannya masih sama." },
    ],
  },
  {
    date: "2026-09-16",
    title: "Sales Activity di ponsel",
    items: [
      { kind: "baru", text: "Nama baru: Sales Mission menjadi Sales Activity, dan \"mission\" menjadi \"aktivitas\". Alamat lama tetap mengarah ke halaman yang benar." },
      { kind: "baru", text: "Bilah navigasi di bawah, tombol Aktivitas baru yang mengambang, pilihan yang terbuka dari bawah layar, dan sasaran sentuh yang lebih besar. Aplikasi bisa dipasang ke layar utama lewat Lainnya → Pasang di ponsel." },
      { kind: "lebih-baik", text: "Di ponsel, daftar memakai satu tombol Filter dan Muat lagi; halaman aktivitas punya satu tombol aksi di bawah; form panjang punya chip bagian dan daftar field yang belum lengkap yang bisa diketuk." },
      { kind: "baru", text: "Panduan singkat di dalam aplikasi, daftar kosong yang menjelaskan langkah pertama, dan petunjuk satu langkah yang muncul sekali per akun." },
      { kind: "lebih-baik", text: "Pindah antara Sales Activity dan LeadEngine memakai layar transisi, tanpa kedip dan tanpa sidebar yang melompat." },
    ],
  },
  {
    date: "2026-09-15",
    title: "Siapa boleh melihat dan mengubah apa",
    items: [
      { kind: "baru", text: "Role & Izin punya Cakupan lihat dan Cakupan ubah per modul: Sendiri, Tim, atau Semua. Tim mengikuti Atasan langsung yang diatur di Pengguna." },
      { kind: "lebih-baik", text: "Daftar orang saat menugaskan mencakup seluruh grup, dan pilihan sales utama mengikuti cakupan peran Anda." },
    ],
  },
  {
    date: "2026-09-15",
    title: "Laporan kunjungan yang diatur admin",
    items: [
      { kind: "baru", text: "Foto di form: bukti kunjungan dan kartu nama. Hasil kunjungan, Tingkat minat, dan Next action adalah pilihan yang diatur admin; pengisi boleh menambah pilihan sendiri bila diizinkan." },
      { kind: "baru", text: "Halaman Laporan: semua laporan kunjungan sebagai daftar yang bisa disaring dan diekspor; waktu kunjungan sebenarnya dicatat di samping jadwalnya." },
      { kind: "lebih-baik", text: "Laporan yang sudah dikirim bisa diubah dengan alasan yang tercatat sebagai versi; draf tersimpan otomatis dan bisa dibuang." },
    ],
  },
  {
    date: "2026-09-15",
    title: "Prospek: pintu kedua sebelum kunjungan",
    items: [
      { kind: "baru", text: "Modul Prospek: calon klien yang sedang dihubungi, dengan status, tanggal hubungi lagi yang muncul di Hari ini, impor dari Excel, funnel, dan sampah." },
      { kind: "lebih-baik", text: "Industri prospek menjadi dropdown yang diatur admin; form prospek diatur seperti form lainnya; daftar pilihan bisa ditempel sekaligus." },
    ],
  },
  {
    date: "2026-09-14",
    title: "Aktivitas: jadwal, tim, dan rapi-rapi",
    items: [
      { kind: "baru", text: "Aktivitas bisa diubah setelah dibuat; sales utama boleh memindahkan jadwal dengan kalender tim terlihat; aktivitas bisa dibatalkan." },
      { kind: "baru", text: "Sampah 30 hari, ekspor Excel, urutkan tiap kolom, hapus massal, dan Riwayat perubahan untuk admin." },
      { kind: "lebih-baik", text: "Satu bagian alamat (jalan, gedung, kota); angka mengelompok ribuan saat diketik; telepon dinormalkan ke satu format; papan live diatur dari dalam aplikasi." },
    ],
  },
  {
    date: "2026-09-13",
    title: "Konfirmasi penugasan opsional",
    items: [
      { kind: "baru", text: "Admin bisa mematikan konfirmasi penugasan; sales menjawab Terima atau Tolak tepat di tempat ia berada, termasuk Hari ini." },
      { kind: "baru", text: "Setiap perusahaan yang dikunjungi didaftarkan otomatis ke LeadEngine, satu perusahaan satu baris." },
      { kind: "lebih-baik", text: "Sapaan bisa diatur; foto profil tampil di semua tempat." },
    ],
  },
  {
    date: "2026-08-29",
    title: "Laporan terstruktur, KPI, dan papan live",
    items: [
      { kind: "baru", text: "Laporan kunjungan terstruktur, Join ke kunjungan rekan dengan peringatan bentrok, jawaban penugasan dan usulan jadwal ulang." },
      { kind: "baru", text: "Kirim peluang ke LeadEngine sebagai lead; klien ditautkan ke perusahaan CRM lewat pencarian langsung." },
      { kind: "baru", text: "Ringkasan KPI, ekspor CSV, notifikasi di aplikasi, dan papan live untuk TV kantor." },
    ],
  },
]
