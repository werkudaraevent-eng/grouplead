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

/**
 * A release worth a dialog. Written with the feature, like the entry; the
 * unit's admin decides in Pengaturan → Pengumuman whether it shows.
 */
export interface Announcement {
  /** Stable slug: the settings row and the "seen" marks hang off it. */
  key: string
  title: string
  /** One sentence, for a sales rep. */
  body: string
  /** Where "Coba sekarang" goes. */
  href?: string
  hrefLabel?: string
  /** Off until an admin switches it on; for a change that is not every rep's business. */
  defaultOn?: boolean
}

export interface ChangeEntry {
  /** YYYY-MM-DD */
  date: string
  title: string
  items: ChangeItem[]
  announcement?: Announcement
}

export const CHANGE_KIND_LABELS: Record<ChangeKind, string> = {
  baru: "Baru",
  "lebih-baik": "Lebih baik",
  diperbaiki: "Diperbaiki",
}

export const CHANGELOG: ChangeEntry[] = [
  {
    date: "2026-09-24",
    title: "Judul yang sama di setiap halaman",
    items: [
      { kind: "lebih-baik", text: "Di komputer, semua halaman kini memakai judul satu baris ramping seperti Aktivitas, Prospek, dan Laporan: Hari ini, Kalender, Papan live, Pengaturan, Notifikasi, Panduan, Yang baru, dan lainnya. Tulisan kecil “SALES ACTIVITY / …” di atas judul sudah hilang." },
      { kind: "lebih-baik", text: "Halaman di dalam Pengaturan, halaman aktivitas, dan halaman prospek kini hanya menyebut induknya di atas judul (misalnya Pengaturan atau Aktivitas), supaya jelas kamu sedang di bagian mana." },
      { kind: "lebih-baik", text: "Kalimat penjelasan di bawah judul halaman mana pun kini bisa ditutup dengan ✕, dan tetap tertutup di komputer atau HP mana pun yang kamu pakai. Keterangan yang berisi fakta, seperti tanggal di Hari ini atau kontak di halaman prospek, tetap tampil." },
      { kind: "lebih-baik", text: "Di Kalender, chip Semua sudah tidak ada dan Saya menjadi chip nyala/mati seperti di Aktivitas. Kalender menampilkan seluruh tim selama tidak ada saringan; untuk kembali ke sana, tekan Bersihkan semua. Kalender publik untuk manajemen ikut sama." },
      { kind: "diperbaiki", text: "Di Hari ini, status kunjungan tidak lagi terpotong (“Diteri…”) saat nama perusahaannya panjang: kini nama perusahaan yang dipotong, statusnya selalu terbaca utuh." },
      { kind: "lebih-baik", text: "Jam di daftar Kalender, Papan live, Notifikasi, dan catatan pendukung kini memakai huruf yang sama dengan tulisan lain, tetap rata satu sama lain." },
      { kind: "diperbaiki", text: "Di komputer, bagian atas menu samping kini sama tinggi dengan baris judul halaman, jadi logo, judul, dan tombol di atas berada di satu garis." },
      { kind: "diperbaiki", text: "Tanda ✕ untuk menutup kalimat penjelasan kini ada tepat setelah kata terakhirnya, juga saat kalimatnya turun ke baris kedua, tidak lagi jauh di kanan." },
    ],
  },
  {
    date: "2026-09-24",
    title: "Daftar yang lebih ringkas: judul satu baris, filter satu baris",
    items: [
      { kind: "lebih-baik", text: "Di komputer, judul Aktivitas, Prospek, dan Laporan kini satu baris ramping bersama tombolnya, tanpa tulisan kecil “SALES ACTIVITY / …” di atasnya, jadi tabel mulai lebih tinggi dan menampilkan lebih banyak baris." },
      { kind: "lebih-baik", text: "Kalimat penjelasan di bawah judul daftar kini bisa ditutup dengan ✕. Sekali ditutup, kalimat itu tidak muncul lagi di daftar tersebut, di komputer atau HP mana pun yang kamu pakai." },
      { kind: "lebih-baik", text: "Di Aktivitas, chip Semua · Saya · Hari ini · Minggu ini · Mendatang tidak lagi menjadi baris sendiri di atas filter. Tanggal kini selalu ada di baris filter (Hari ini, Minggu ini, Mendatang, dan lainnya dipilih di dalamnya), dan Saya menjadi chip nyala/mati di baris yang sama, begitu juga Butuh jawaban dan Menunggu tim beserta jumlahnya. Memilih Hari ini tidak lagi tampil dua kali. Untuk kembali melihat semua, tekan Bersihkan semua. Di HP, keempatnya ada di satu baris di bawah kolom cari." },
      { kind: "lebih-baik", text: "Tautan yang pernah kamu simpan, tampilan tersimpan, dan daftar yang diingat tetap membuka daftar yang sama seperti sebelumnya." },
      { kind: "lebih-baik", text: "Di HP, kartu Laporan kini berbentuk sama dengan kartu Aktivitas dan Prospek: sales utama dengan fotonya di kiri bawah, dan tindak lanjutnya sebagai chip di kanan bawah (Follow-up dengan harinya, kuning bertuliskan Lewat bila harinya sudah lewat, abu-abu bila sudah selesai). Nama sales tidak lagi ditulis dua kali; peluang dan nomor lead dibaca di laporannya atau di tabel komputer." },
      { kind: "diperbaiki", text: "Di tabel, kolom Aksi yang tetap di kanan kini punya garis dan bayangan tipis di sisi kirinya, jadi kolom yang digeser ke bawahnya tidak lagi tampak terpotong." },
    ],
  },
  {
    date: "2026-09-24",
    title: "Huruf aplikasi dan tabel yang lebih lapang",
    items: [
      { kind: "diperbaiki", text: "Aplikasi kini benar-benar memakai huruf Plus Jakarta Sans. Selama ini yang tampil huruf bawaan perangkat karena pengaturannya tidak terbaca." },
      { kind: "lebih-baik", text: "Tabel Aktivitas, Prospek, dan Laporan mendapat ruang lebih: bagian bawah halaman dan baris halaman di bawah tabel dibuat lebih ramping, batang geser tidak lagi menampilkan panah yang menabrak sudut kartu dan dimulai di bawah judul kolom, dan judul kolom Aksi kini rata kiri seperti tombolnya." },
      { kind: "diperbaiki", text: "Menu Kolom tidak lagi terpotong di bagian bawah layar: tingginya menyesuaikan ruang yang ada, judul dan Susunan awal tetap di atas, dan daftar kolomnya bisa digulir." },
    ],
  },
  {
    date: "2026-09-24",
    title: "Tabel daftar memenuhi layar, judul kolom selalu terlihat",
    items: [
      { kind: "lebih-baik", text: "Di komputer, tabel Aktivitas, Prospek, dan Laporan kini memenuhi layar di bawah baris filter dan bergulir di dalam kartunya sendiri. Judul kolom tetap di atas saat daftar digulir ke bawah, penggeser ke samping selalu ada di dasar kartu (tidak perlu lagi menggulir sampai baris terakhir untuk menemukannya), dan Baris per halaman serta tombol halaman berikutnya selalu tampil di bawahnya." },
      { kind: "lebih-baik", text: "Kolom Aksi kini selebar tombol yang ada di halaman itu, tidak lagi selebar tetap. Sisa lebarnya diberikan ke nama aktivitas atau perusahaan, jadi nama yang panjang lebih jarang terpotong dan tidak ada lagi ruang kosong sebelum kolom Aksi." },
      { kind: "lebih-baik", text: "Keterangan urutan seperti “terdekat dulu” tidak lagi menempel di judul kolom. Kolom yang memegang urutan bawaan (Jadwal di Aktivitas, Hubungi lagi di Prospek, Status di Laporan) ditandai panah abu-abu; arahkan kursor ke judulnya untuk membaca urutannya dan apa yang terjadi kalau diklik." },
      { kind: "diperbaiki", text: "Di Prospek, tombol Catat follow-up (untuk prospek tanpa telepon dan email) beserta ⋮ di sebelahnya tidak lagi menutupi pinggir kolom di sebelah kirinya." },
    ],
  },
  {
    date: "2026-09-24",
    title: "Tampilan tersimpan dan pilihan kolom di Aktivitas, Prospek, dan Laporan",
    // Desk work for whoever reads lists all day; the admin switches it on after training.
    announcement: {
      key: "saved-views",
      title: "Simpan tampilan daftar",
      body: "Atur filter, urutan, dan kolom sekali, beri nama, lalu buka lagi dengan satu klik di atas daftar Aktivitas, Prospek, atau Laporan.",
      href: "/workspace/activities",
      hrefLabel: "Buka daftar aktivitas",
      defaultOn: false,
    },
    items: [
      { kind: "baru", text: "Simpan tampilan: di komputer, atur pencarian, filter, urutan, jumlah baris per halaman, dan kolom di Aktivitas, Prospek, atau Laporan, lalu klik ikon Simpan tampilan di ujung kanan baris filter dan beri nama, misalnya “Tim Jakarta minggu ini”. Tampilan tersimpan muncul sebagai chip di atas daftar; satu klik membukanya lagi persis seperti saat disimpan. Tampilanmu hanya terlihat olehmu." },
      { kind: "baru", text: "Di samping chip ada ⋮ untuk menyimpan salinan, mengubah nama, menjadikan tampilan itu bawaan, atau menghapusnya. Hapus tidak perlu konfirmasi: klik Batalkan di notifikasinya untuk mengembalikan. Kalau tampilan yang terakhir kamu pilih diubah, muncul Simpan perubahan untuk memperbaruinya." },
      { kind: "baru", text: "Tampilan bawaan dipakai saat daftar itu pertama kali dibuka di sebuah browser (misalnya laptop baru). Selebihnya daftar tetap terbuka seperti terakhir kamu tinggalkan, dan tautan yang dikirim rekan tetap membuka apa yang dia kirim." },
      { kind: "baru", text: "Tombol Kolom di samping Simpan tampilan memilih kolom mana yang tampil dan urutannya: centang untuk menampilkan, seret untuk memindah, Susunan awal untuk kembali. Ada kolom baru yang bisa ditambahkan, antara lain Lokasi, Hasil, dan Penugasan di Aktivitas; Telepon, Email, dan Terakhir dihubungi di Prospek; Minat, Peluang, dan Tindak lanjut di Laporan. Pilihannya diingat per daftar di browser ini dan ikut tersimpan di tampilan." },
      { kind: "lebih-baik", text: "Tabel di komputer kini satu baris per aktivitas, prospek, atau laporan, sehingga lebih banyak yang terlihat sekaligus. Keterangan yang dulu ada di baris kedua pindah ke kolomnya sendiri (misalnya Jenis di Aktivitas dan Hubungi lagi di Prospek), dan teks yang terpotong tampil utuh saat kursor diarahkan ke atasnya." },
      { kind: "lebih-baik", text: "Kalau kolom yang dipilih lebih lebar dari layar, tabel digeser ke samping di dalam kartunya, sementara kotak centang dan nama perusahaan tetap di tempat, begitu juga tombol di kolom Aksi. Kolom Lokasi dan Dibuat tidak lagi hilang sendiri di layar laptop; tampilkan lewat Kolom kalau perlu." },
      { kind: "lebih-baik", text: "Di HP daftar kartunya tidak berubah; tampilan tersimpan bisa dipilih di bagian atas lembar Filter." },
    ],
  },
  {
    date: "2026-09-23",
    title: "Angka hasil filter dan urutan tetap sama di semua daftar",
    items: [
      { kind: "diperbaiki", text: "Angka “X dari Y” di atas daftar sekarang artinya sama di Aktivitas, Prospek, dan Laporan: X semua yang cocok dengan filter (bukan hanya yang tampil di halaman ini), Y semua tanpa filter. Di Laporan tadinya X hanya isi satu halaman, dan di Aktivitas kadang terbaca “N dari N”." },
      { kind: "lebih-baik", text: "Judul kolom di tabel Aktivitas, Prospek, dan Laporan kini ditulis biasa, tidak lagi huruf kapital kecil yang renggang, jadi selaras dengan tulisan lain di halaman." },
      { kind: "lebih-baik", text: "Filter yang sedang aktif kini diberi tanda centang selain warnanya, termasuk tombol Butuh follow-up di Prospek, jadi sekilas terlihat mana yang sedang menyaring. Chip filter di HP juga bersudut, tidak lagi bulat penuh, sama seperti chip lain di aplikasi." },
      { kind: "diperbaiki", text: "Mengubah filter tidak lagi mengembalikan urutan dan jumlah baris per halaman ke bawaan. Di ketiga daftar, urutan dan ukuran halaman yang kamu pilih tetap, dan daftar kembali ke halaman pertama." },
    ],
  },
  {
    date: "2026-09-23",
    title: "Mematikan lalu menyalakan pengumuman tidak lagi memunculkannya ulang",
    items: [
      { kind: "diperbaiki", text: "Di Pengaturan → Pengumuman, menggeser saklar sebuah pengumuman (mati lalu nyala lagi) membuat dialog Yang baru muncul lagi untuk orang yang sudah menutupnya, padahal halaman itu menjanjikan tidak. Sekarang saklar hanya menentukan tampil atau tidak; yang memunculkan dialog lagi untuk semua akun hanya tombol Umumkan ulang. Keterangan “terakhir diumumkan” juga hanya muncul setelah Umumkan ulang dipakai." },
    ],
  },
  {
    date: "2026-09-23",
    title: "Halaman Pengaturan jadi daftar berkelompok",
    items: [
      { kind: "lebih-baik", text: "Pengaturan tidak lagi berupa 15 kartu dalam tiga kolom. Sekarang satu daftar yang dibaca dari atas ke bawah, dikelompokkan menjadi Form, Alur kerja, Komunikasi, Pemantauan, dan Sistem, supaya yang dicari lebih cepat ketemu, di layar lebar maupun di HP. Tiap baris punya ikonnya sendiri dan penjelasan singkat yang tidak lagi terpotong di HP." },
      { kind: "lebih-baik", text: "Kartu Notifications dan Access yang bertanda Belum tersedia dihapus. Soal akses, di bawah daftar kini ada keterangan bahwa siapa boleh membuka Sales Activity diatur di LeadEngine, pada Settings → Roles & permissions, lengkap dengan tautannya." },
    ],
  },
  {
    date: "2026-09-23",
    title: "Layar error berbahasa Inggris setelah pembaruan aplikasi diganti muat ulang otomatis",
    items: [
      { kind: "diperbaiki", text: "Tepat setelah aplikasi diperbarui, tab yang masih terbuka kadang menampilkan “Application error: a client-side exception has occurred” dan baru pulih setelah dimuat ulang berkali-kali. Sekarang halamannya memuat ulang sendiri satu kali; kalau masih gagal juga, yang tampil layar “Halaman ini gagal dimuat” berbahasa Indonesia dengan tombol Muat ulang dan Kembali ke dashboard." },
      { kind: "diperbaiki", text: "Ikon aplikasi untuk dipasang di layar utama dan pekerja latar (service worker) tadinya ikut dialihkan ke halaman login, sehingga pemasangan ke layar utama tidak berjalan dan console browser penuh peringatan. Keduanya kini diambil langsung." },
    ],
  },
  {
    date: "2026-09-23",
    title: "Pemakaian: admin bisa melihat siapa yang membuka aplikasi, kapan, dan halaman mana",
    items: [
      { kind: "baru", text: "Pengaturan → Pemakaian menunjukkan berapa orang yang membuka Sales Activity hari ini, dalam 7 hari, dan dalam 30 hari, dibanding jumlah orang yang punya akses. Di bawahnya satu baris per orang: kapan terakhir aktif (misalnya “2 jam lalu”; arahkan kursor untuk jam persisnya), berapa hari aktif dalam 30 hari, berapa halaman dibuka dalam 7 hari, garis tren hari aktif per minggu selama 8 minggu, dan halaman terakhir yang dibuka. Semua orang dengan akses tampil, termasuk yang belum pernah membuka; yang 7 hari tidak membuka aplikasi diberi tanda Tidak aktif 7 hari. Berguna untuk melihat siapa yang perlu dibantu memakai aplikasinya, bukan hanya siapa yang mengisi laporan." },
      { kind: "baru", text: "Grafik Pengguna aktif per hari, tepat di bawah angka ringkasan: satu batang per hari untuk 7, 30, atau 90 hari terakhir, berapa orang yang membuka aplikasi hari itu, supaya naik-turunnya pemakaian terlihat sekilas dan tidak hanya dari tiga angka. Sabtu dan Minggu berwarna abu-abu supaya pola mingguan tim langsung terbaca; arahkan kursor ke sebuah batang untuk hari dan jumlah orangnya. Periode yang dipilih di grafik ini juga berlaku untuk Halaman paling dibuka, dan sebaliknya." },
      { kind: "baru", text: "Halaman paling dibuka, untuk 7, 30, atau 90 hari: mana yang benar-benar dipakai tim, misalnya Hari ini, Detail aktivitas, atau Laporan · Ringkasan." },
      { kind: "baru", text: "Yang dicatat hanya halaman yang dibuka dan kapan, satu catatan per orang per hari. Yang tidak dicatat: isi yang diketik, data yang dilihat, dan lokasi; membuka sebuah aktivitas tercatat sebagai Detail aktivitas, bukan aktivitas yang mana. Hanya admin yang bisa membuka halaman ini. Pencatatan mulai hari ini, jadi angkanya terisi dari sekarang." },
    ],
  },
  {
    date: "2026-09-22",
    title: "Ekspor laporan sekarang berisi seluruh isi laporan, bukan ringkasannya",
    items: [
      { kind: "lebih-baik", text: "Tombol Ekspor di Laporan tadinya hanya memberi 17 kolom ringkas berisi kode seperti MET_DECISION_MAKER dan jumlah orang yang ditemui. Sekarang berkasnya berisi apa yang benar-benar kamu tulis: ringkasan pertemuan, kebutuhan klien, produk yang diminati, tingkat minat, estimasi nilai, kompetitor yang disebut, next action dan penanggung jawabnya, catatan klarifikasi, catatan pendukung, status kirim ke LeadEngine beserta kategori leadnya, dan tindak lanjutnya. Judul kolomnya mengikuti nama kolom di Form laporan unitmu — kalau admin mengganti nama sebuah kolom, judul di berkasnya ikut berganti — termasuk semua kolom tambahan yang dibuat admin, dalam urutan yang sama seperti di form. Isinya pakai kata yang sama dengan di layar, bukan kodenya." },
      { kind: "baru", text: "Orang yang ditemui ikut lengkap, dan tiap orang punya kolomnya sendiri: Kontak 1 · Nama, Kontak 1 · Jabatan, Kontak 1 · Telepon, Kontak 1 · Email, Kontak 1 · Pengambil keputusan, Kontak 1 · DISC, Kontak 1 · Catatan DISC, lalu Kontak 2, Kontak 3, dan seterusnya sebanyak orang terbanyak dalam satu laporan di berkas itu. Laporan yang ketemu lebih sedikit orang kolom sisanya dibiarkan kosong. Jadi nomor telepon atau pengambil keputusan bisa disaring dan diurutkan di Excel, tidak lagi menumpuk dalam satu sel. Sheet Kontak tetap ada dan tetap memberi satu baris per orang dengan catatan DISC, penilainya, dan tanggal penilaiannya. Kalau ada catatan pendukung dari rekan yang ikut, ada sheet Catatan pendukung berisi penulis, catatan, dan kapan ditulis." },
      { kind: "baru", text: "Foto dan rekaman pertemuan ikut sebagai tautan: nama berkasnya diikuti tautan yang bisa langsung dibuka, berlaku 7 hari sejak berkasnya diunduh. Lewat dari itu, ekspor lagi. Tiap baris juga punya Tautan laporan yang membuka laporannya di aplikasi — tautan ini tidak kedaluwarsa, tapi tetap minta login, jadi aman dibagikan ke sesama anggota unit." },
      { kind: "lebih-baik", text: "Semua jam dan tanggal ditulis dalam WIB dan dipisah jadi kolom tanggal dan kolom jam, jadi bisa diurutkan dan dihitung di Excel. Estimasi nilai dan kolom angka tambahan tersimpan sebagai angka, bukan teks, jadi bisa langsung dijumlahkan. Ekspor CSV tetap ada dan berisi sheet Laporan saja." },
    ],
  },
  {
    date: "2026-09-22",
    title: "Keterangan di kaki kartu Insight tidak lagi terjepit di samping tombol",
    items: [
      { kind: "diperbaiki", text: "Pada kartu Insight di Ringkasan, keterangan “Dibuat … · dari N laporan hari ini · AI bisa keliru” terjepit jadi kolom sempit di samping tombol Baca brief lengkap dan Buat ulang, sehingga terbaca sebagai lima baris pendek. Kalau kartunya sempit, keterangannya sekarang di atas dan tombolnya di bawah; pada kartu lebar keduanya tetap satu baris." },
    ],
  },
  {
    date: "2026-09-22",
    title: "Kolom tulisan panjang ikut tumbuh, dan daftar bernomor berlanjut sendiri",
    items: [
      { kind: "lebih-baik", text: "Semua kolom tulisan panjang — Ringkasan pertemuan, Catatan janji temu, alasan batal atau pindah jadwal, catatan tindak lanjut, catatan prospek, catatan pendukung — sekarang tingginya mengikuti apa yang kamu tulis. Tidak ada lagi kotak kecil yang membuat kalimat pertama hilang ke atas saat mengetik di HP, dan tidak ada lagi sudut yang harus diseret untuk memperbesar. Setelah sekitar 14 baris kotaknya berhenti tumbuh dan isinya yang bergulir di dalam, supaya tombol Kirim tetap terlihat." },
      { kind: "baru", text: "Daftar berlanjut sendiri. Ketik “1. ” lalu Enter dan baris berikutnya sudah dimulai “2. ”; ketik “- ” dan Enter meneruskan tanda yang sama. Enter sekali lagi pada butir yang masih kosong mengakhiri daftarnya. Kalau hanya butuh pindah baris tanpa tanda daftar, tekan Shift+Enter." },
      { kind: "lebih-baik", text: "Catatan “Cara menghadapi orang ini” pada gaya komunikasi (DISC) tadinya kolom satu baris, jadi tulisan yang agak panjang bergeser ke samping dan awalnya tidak terlihat lagi. Sekarang kolom biasa yang ikut tumbuh seperti yang lain." },
    ],
  },
  {
    date: "2026-09-22",
    title: "Brief AI selesai sendiri walau kamu pindah halaman, dan Tanya AI menyimpan percakapan",
    items: [
      { kind: "lebih-baik", text: "Menyusun brief butuh waktu, jadi halamannya kini menunggu sendiri: selama brief sedang dibuat, kartu Insight dan tab Insight memeriksa ulang tiap beberapa detik sampai brief-nya muncul, tanpa perlu memuat ulang halaman. Boleh pindah halaman sementara; brief tetap disusun di server. Kalau lebih dari empat menit belum selesai juga, halamannya berhenti menunggu dan mengatakannya, bukan berputar terus." },
      { kind: "diperbaiki", text: "Kalau server terputus di tengah pembuatan brief, tulisan “Menyusun brief…” bisa menetap sepanjang hari dan Buat ulang pun tidak membuahkan apa-apa. Sekarang pembuatan yang menggantung lebih dari tiga menit dianggap gagal, lalu brief-nya dibuat ulang otomatis pada pembukaan berikutnya, pada jadwal sepuluh menitan, atau saat kamu menekan Buat ulang." },
      { kind: "baru", text: "Tanya AI menyimpan percakapan untuk akunmu sendiri. Tutup panelnya atau pindah halaman, percakapannya tetap ada; saat panel dibuka lagi, percakapan terakhir hari ini otomatis dilanjutkan. Riwayat menampilkan percakapan tersimpan dengan judul dari pertanyaan pertama, kapan terakhir dipakai, dan jumlah pertanyaannya — ketuk untuk melanjutkan, Hapus untuk membuangnya, Percakapan baru untuk mulai dari awal. Percakapan hanya bisa dibaca olehmu dan dihapus otomatis setelah 90 hari." },
    ],
  },
  {
    date: "2026-09-22",
    title: "Brief AI tidak lagi gagal karena batas waktu 20 detik",
    items: [
      { kind: "diperbaiki", text: "Brief yang dibuat dari banyak laporan butuh lebih dari 20 detik, dan aplikasi memutusnya lalu menampilkan “Endpoint tidak menjawab dalam 20 detik”. Batas waktunya kini 90 detik untuk brief dan 45 detik untuk Tanya AI; Uji koneksi di Pengaturan tetap 20 detik." },
    ],
  },
  {
    date: "2026-09-22",
    title: "Insight harian jadi brief: perlu ditindak, yang terdengar di lapangan, dan rekomendasi",
    items: [
      { kind: "lebih-baik", text: "Insight harian tidak lagi sekadar membacakan angka. AI sekarang ikut membaca isi laporan (ringkasan pertemuan, kebutuhan klien, produk yang diminati, kompetitor yang disebut, siapa yang ditemui dan catatan DISC-nya bila dipakai), lalu menyusunnya jadi tiga bagian: Perlu ditindak, Yang terdengar di lapangan, dan Rekomendasi. Angka tetap dihitung aplikasi, bukan oleh AI, jadi masih bisa dicek di kartu lain." },
      { kind: "baru", text: "Ada tab baru Insight di Laporan, di samping Daftar dan Ringkasan, berisi brief lengkapnya. Daftar hari di sebelahnya menyimpan brief 30 hari terakhir, jadi brief kemarin masih bisa dibaca. Poin yang ditulis dari laporan tertentu punya tautan Lihat laporan langsung ke laporannya." },
      { kind: "baru", text: "Tombol Bagikan ke WhatsApp di tab Insight mengirim brief hari itu sebagai teks ke grup: share sheet di HP, WhatsApp desktop atau WhatsApp Web di komputer." },
      { kind: "lebih-baik", text: "Kartu Insight di papan Ringkasan kini hanya menggoda: maksimal tiga poin, yang perlu ditindak lebih dulu, tanpa scroll di dalam kartu, plus tombol Baca brief lengkap ke tab Insight. Buat ulang dan keterangan Dibuat AI tetap ada." },
    ],
  },
  {
    date: "2026-09-21",
    title: "Fitur baru diumumkan saat membuka Hari ini; admin yang memilih",
    items: [
      { kind: "baru", text: "Saat membuka Hari ini, dialog Yang baru menampilkan sampai tiga fitur baru yang siap dipakai, masing-masing dengan tombol Coba sekarang. Muncul sekali per akun; pilih Nanti saja untuk menutupnya, titik di menu Yang baru tetap ada sampai halamannya dibuka." },
      { kind: "baru", text: "Admin memilih fitur mana yang diumumkan di Pengaturan → Pengumuman: saklar per rilis, dan Umumkan ulang untuk memunculkan dialognya lagi ke semua akun, misalnya setelah training." },
    ],
  },
  {
    date: "2026-09-21",
    title: "Ringkasan: kartu angka lebih ringkas, dan cara mengubah ukurannya terlihat",
    items: [
      { kind: "lebih-baik", text: "Kartu angka (Laporan, Peluang, Nilai estimasi, Lead ke CRM) menaruh angkanya tepat di bawah judul, bukan di dasar kartu, dan saat ditambahkan langsung berukuran Ringkas: seperempat lebar, setinggi sekitar setengah kartu Kecil." },
      { kind: "baru", text: "Ukuran cepat di menu ⋮ kartu punya pilihan Ringkas untuk kartu yang muat: angka, angka bertren, donat, dan daftar batang. Pilihan yang tidak muat untuk bentuk kartu itu dinonaktifkan, di menu maupun di formulir widget sendiri." },
      { kind: "diperbaiki", text: "Saat Atur widget aktif, pegangan ubah ukuran di sudut kanan bawah setiap kartu selalu terlihat, tidak lagi menunggu kursor lewat, dan ada satu kalimat petunjuk di atas papan: seret judul untuk memindah, seret sudut untuk mengubah ukuran. Kartu angka polos bisa diperpendek sampai tiga baris." },
    ],
  },
  {
    date: "2026-09-21",
    title: "Aktivitas yang sudah selesai masih bisa dirapikan keterangannya",
    announcement: {
      key: "edit-completed",
      title: "Ubah aktivitas setelah laporan dikirim",
      body: "Kontak janji temu, alamat, dan tujuan kunjungan yang sudah selesai bisa dirapikan lewat Ubah aktivitas, tanpa menarik laporan.",
      href: "/workspace/activities",
      hrefLabel: "Buka daftar aktivitas",
      defaultOn: false,
    },
    items: [
      { kind: "lebih-baik", text: "Setelah laporan dikirim, Ubah aktivitas tetap tersedia untuk merapikan keterangan kunjungan: nama, jabatan, dan nomor kontak janji temu, alamat, industri, tujuan, dan isian tambahan. Tidak perlu lagi menarik laporan hanya untuk membetulkan nama." },
      { kind: "lebih-baik", text: "Yang tetap dibekukan pada kunjungan yang sudah selesai: jadwal dan tim, karena keduanya bagian dari apa yang terjadi. Formulir menampilkannya apa adanya tanpa bisa diubah. Aktivitas yang dibatalkan tetap tidak bisa diubah. Siapa yang benar-benar ditemui tetap diubah lewat Ubah laporan → Ketemu siapa." },
    ],
  },
  {
    date: "2026-09-21",
    title: "Daftar Laporan: klik barisnya, seperti di Aktivitas dan Prospek",
    items: [
      { kind: "lebih-baik", text: "Baris di daftar Laporan kini membuka laporannya dengan sekali klik di mana saja pada baris itu, sama seperti Aktivitas dan Prospek. Tombol Lihat dan panah di ujung baris dihapus karena keduanya membuka halaman yang sama; Ctrl/Cmd+klik atau klik pada nama tetap membuka di tab baru." },
      { kind: "diperbaiki", text: "Di kartu laporan, label Pengambil keputusan dan DISC di samping nama kontak tidak lagi terpotong di tengah kata saat ruangnya sempit; label pindah utuh ke baris berikutnya." },
      { kind: "diperbaiki", text: "Tindak lanjut yang dibatalkan tidak lagi menulis Dibatalkan dua kali; di bawah judulnya langsung alasan pembatalan, siapa, dan kapan." },
      { kind: "diperbaiki", text: "Ubin sorotan di kartu laporan (Hasil, Tingkat minat, Peluang, Waktu kunjungan) boleh dua baris, sehingga hasil seperti Bertemu pengambil keputusan tidak lagi terpotong." },
    ],
  },
  {
    date: "2026-09-21",
    title: "Kartu laporan di layar lebar: isi di kiri, pendamping di kanan",
    items: [
      { kind: "lebih-baik", text: "Di komputer, kartu laporan tidak lagi menyisakan sisi kanan kosong. Tindak lanjut dan ringkasan pembicaraan tetap di kolom utama dengan lebar baca yang nyaman; Ketemu siapa, foto dan rekaman, serta status CRM pindah ke panel pendamping di kanan, mengikuti tata letak Material untuk jendela lebar. Di ponsel dan tablet urutannya tetap seperti sekarang." },
    ],
  },
  {
    date: "2026-09-21",
    title: "Peluang yang belum dicentang tidak lagi dibaca sebagai tidak ada",
    items: [
      { kind: "diperbaiki", text: "Ubin Peluang di kartu laporan kini menulis Belum ditandai, bukan Tidak ada, kalau centang Ada peluang di laporan kosong; keterangannya menyebut centang itu belum diisi. Centang itu opsional dan menjadi syarat Kirim ke LeadEngine, jadi kosong artinya belum ditandai, bukan tidak ada peluang." },
      { kind: "diperbaiki", text: "Variabel {peluang} pada teks bagikan ke WhatsApp mengikuti aturan yang sama: Ada peluang, atau Belum ditandai." },
    ],
  },
  {
    date: "2026-09-21",
    title: "Kartu laporan dibaca dari sorotan; semua isian sales tampil",
    items: [
      { kind: "lebih-baik", text: "Kartu laporan di halaman aktivitas kini dibuka dengan strip sorotan: Hasil, Tingkat minat, Peluang beserta estimasi nilainya, dan Waktu kunjungan dalam satu baris ubin; lalu Tindak lanjut, Ringkasan dan pembicaraan, Ketemu siapa, dan lampiran, masing-masing dalam bagiannya. Teks ringkasan tidak lagi membentang selebar layar." },
      { kind: "diperbaiki", text: "Empat isian laporan yang sebelumnya tidak tampil di halaman aktivitas kini terlihat: Produk yang diminati, Ada peluang, Estimasi nilai, dan Kompetitor disebut. Penanggung jawab next action juga tampil." },
      { kind: "diperbaiki", text: "Laporan yang dikirim sebelum fitur tindak lanjut ada kini mendapat tindak lanjut terbuka dari next action-nya, sehingga muncul di Hari ini pemiliknya dan di kartu laporan; yang belum dilacak tetap memperlihatkan next action dari laporannya." },
    ],
  },
  {
    date: "2026-09-21",
    title: "Bagikan ke WhatsApp dari komputer: langsung ke aplikasinya, atau WhatsApp Web",
    items: [
      { kind: "lebih-baik", text: "Dari komputer, Bagikan ke WhatsApp tidak lagi membuka share sheet Windows yang membingungkan. Aplikasi mencoba WhatsApp desktop; kalau terpasang, WhatsApp terbuka dengan teks laporan terisi. Kalau tidak terpasang, WhatsApp Web yang dibuka, dan pesannya menjelaskan kenapa. Pilihan ini diingat untuk klik berikutnya." },
      { kind: "lebih-baik", text: "Notifikasi kecil (toast) di komputer pindah ke kiri bawah, tempat yang ditentukan Material Design; di ponsel tetap di bawah. Penjelasan soal WhatsApp Web beserta tombolnya kini tampil sebagai banner di kartu laporan sampai ditutup, bukan toast yang keburu hilang." },
      { kind: "lebih-baik", text: "Di komputer, foto pertama laporan diunduh otomatis dengan nama rapi (klien-tanggal.jpg) untuk diseret ke chat, karena WhatsApp desktop maupun WhatsApp Web hanya menerima teks lewat tautan. Di ponsel tidak ada yang berubah: teks dan foto ikut lewat share sheet." },
    ],
  },
  {
    date: "2026-09-21",
    title: "Tindak lanjut yang hidup: dari next action sampai selesai",
    announcement: {
      key: "follow-ups",
      title: "Tindak lanjut yang dilacak",
      body: "Next action di laporan kini punya penanggung jawab, jatuh tempo, dan status. Muncul di Hari ini sampai kamu mencatat hasilnya.",
      href: "/workspace/reports",
      hrefLabel: "Lihat di daftar laporan",
    },
    items: [
      { kind: "baru", text: "Next action di laporan kini menjadi tindak lanjut yang dilacak: punya penanggung jawab, jatuh tempo, dan status. Muncul di Hari ini pemiliknya pada bagian Tindak lanjut hari ini (yang lewat tanggal ditandai) sampai dicatat hasilnya." },
      { kind: "baru", text: "Di kartu laporan ada Catat tindak lanjut: lewat apa, bagaimana hasilnya, kapan, catatan, dan kalau perlu langkah berikutnya, yang langsung dibuka sebagai tindak lanjut baru. Rangkaiannya tampil sebagai riwayat di kartu laporan; Tambah tindak lanjut untuk membuka langkah baru, ⋮ untuk membatalkan." },
      { kind: "lebih-baik", text: "Kolom Next action di daftar Laporan kini berkata jujur: Terbuka, Lewat, Selesai beserta hasil dan tanggalnya, dan berapa langkah yang sudah dijalani." },
      { kind: "baru", text: "Tindak lanjut yang diberikan ke orang lain mengirim notifikasi ke penerimanya. Yang boleh mencatat: penanggung jawabnya, sales utama, atau admin yang membawahi laporan." },
      { kind: "baru", text: "Admin mengatur pilihan cara dan hasil tindak lanjut di Pengaturan → Tindak lanjut, dan bisa mematikan pelacakannya di Aturan aktivitas." },
    ],
  },
  {
    date: "2026-09-21",
    title: "Setelah kirim laporan: langsung ditawari bagikan ke WhatsApp",
    items: [
      { kind: "baru", text: "Begitu laporan terkirim, penulisnya melihat kartu “Laporan terkirim” di atas laporan dengan tombol Bagikan ke WhatsApp; di ponsel tombol itu jadi langkah berikutnya di bilah bawah. Tidak ada pop-up: tawarannya menempel di laporan sampai dibagikan atau ditunda dengan Nanti saja." },
      { kind: "baru", text: "Laporan yang sudah dibagikan lewat aplikasi mencatat siapa dan kapan (“Dibagikan ke WhatsApp oleh Ananda · Sen, 21 Sep, 13.20”), jadi tawaran tidak muncul lagi dan atasan tahu laporan mana yang sudah masuk grup." },
      { kind: "baru", text: "Admin bisa mematikan tawaran ini di Pengaturan → Aturan aktivitas → Laporan kunjungan untuk unit yang tidak memakai grup WhatsApp; tombol Bagikan di kartu laporan tetap ada." },
    ],
  },
  {
    date: "2026-09-21",
    title: "Bagikan laporan ke WhatsApp, QR jadwal di layar TV",
    announcement: {
      key: "share-whatsapp",
      title: "Bagikan laporan ke WhatsApp",
      body: "Setelah kirim laporan, satu ketukan menyusun teks laporan beserta fotonya untuk grup WhatsApp. Tinggal pilih grupnya.",
      href: "/workspace/reports",
      hrefLabel: "Buka daftar laporan",
    },
    items: [
      { kind: "baru", text: "Di laporan yang sudah dikirim ada tombol Bagikan ke WhatsApp: teksnya disusun otomatis dari laporan dalam format grup (tanggal, jam, klien, PIC, jabatan, ringkasan) beserta foto pertama, lalu kamu tinggal memilih grupnya di ponsel. Tidak perlu mengetik ulang, formatnya selalu sama." },
      { kind: "baru", text: "Formatnya diatur admin di Pengaturan → Aturan aktivitas → Laporan kunjungan: ketik sendiri, sisipkan isian seperti {klien}, {pic}, {hasil}, {ringkasan}, {foto} dengan sekali ketuk, dan lihat contoh hasilnya langsung. Baris yang isiannya kosong tidak ikut terkirim." },
      { kind: "diperbaiki", text: "Kepala kartu Laporan kunjungan di ponsel tidak lagi berebut tempat: status menempel di judul, tombol turun ke baris sendiri, dan Ubah laporan, Minta klarifikasi, serta Tarik kembali ada di menu ⋮ (di komputer, Ubah laporan tetap terlihat)." },
      { kind: "baru", text: "Saat membuat tautan layar ada saklar Sertakan QR ke kalender: layar TV menampilkan QR kecil ke Jadwal tim, jadi siapa pun bisa memindai dan mengecek jadwal di ponselnya sendiri, tanpa login, dengan penyamaran nama yang sama seperti di layar. Tautan kalendernya tampil di Tautan publik dan bisa dicabut terpisah." },
    ],
  },
  {
    date: "2026-09-21",
    title: "Papan live: hasil kunjungan, angka yang jujur, tanpa kata status",
    items: [
      { kind: "baru", text: "Saat membuat tautan layar ada saklar Tampilkan hasil kunjungan: baris yang sudah dilaporkan menyebut hasilnya (“Bertemu pengambil keputusan”, “Klien tidak ada”) dengan warna menurut jenisnya. Seperti nama klien, keputusan ini terikat ke tautan dan tidak bisa diubah dari URL; nyalakan hanya untuk ruang tim sendiri." },
      { kind: "lebih-baik", text: "Kartu progres kini menghitung yang sudah berlangsung, bukan hanya yang sudah diketik: “4 / 6 sudah berlangsung”, batang dua warna (hijau dilaporkan, kuning berlangsung tapi belum dilaporkan), dan ubin Belum dilaporkan yang menyala kalau ada. Pukul 16.00 papan tidak lagi berkata 1 dari 6 selesai saat lima orang sudah kembali ke meja." },
      { kind: "lebih-baik", text: "Kolom kanan tiap baris jadwal tidak lagi memuat kata status penugasan (Diterima, Ditugaskan). Yang tampil: jam selesai untuk yang belum mulai, Sekarang, Selesai, atau Belum dilaporkan begitu jamnya lewat tanpa laporan. Jenis kunjungan tampil sebagai chip kecil di samping nama klien." },
    ],
  },
  {
    date: "2026-09-21",
    title: "Papan live: siapa sedang di mana, terbaca dari jauh",
    items: [
      { kind: "lebih-baik", text: "Sorotan di atas Papan live kini memperlihatkan semua kunjungan yang sedang berlangsung, bukan hanya satu: “Sedang berlangsung · 3 kunjungan” dengan tiga yang pertama berdampingan, sisanya dihitung, dan semuanya menyala di jadwal." },
      { kind: "lebih-baik", text: "Daftar Tim di lapangan diurutkan menurut pertanyaan orang kantor: yang sedang bersama klien dulu (baris menyala, menyebut klien dan lokasinya), lalu yang sebentar lagi berangkat (“Berikutnya 15.00 · …”), lalu yang jadwalnya selesai. Angka di ujung baris kini bertuliskan “kunj.” supaya jelas apa yang dihitung." },
      { kind: "lebih-baik", text: "Daftar yang lebih panjang dari layar kini berpindah per halaman, mulai dari baris yang tadi terpotong, jadi tidak ada baris yang tampil setengah. Halaman yang memuat kunjungan yang sedang berlangsung ditahan dua kali lebih lama." },
    ],
  },
  {
    date: "2026-09-21",
    title: "Kalender bisa dibuka lagi",
    items: [
      { kind: "diperbaiki", text: "Halaman Kalender dan Jadwal tim gagal dimuat sesaat setelah pembaruan pengelompokan; tombol kelompokkan menerima data yang tidak boleh dikirim ke komponen klien. Sudah diperbaiki." },
    ],
  },
  {
    date: "2026-09-21",
    title: "Jawaban Tanya AI rapi, Pemakaian AI di halaman sendiri",
    items: [
      { kind: "diperbaiki", text: "Jawaban Tanya AI tidak lagi memperlihatkan tanda ** mentah: bagian yang ditebalkan model tampil tebal, daftar tampil sebagai daftar. Poin Insight hari ini juga dibersihkan dari tanda itu." },
      { kind: "lebih-baik", text: "Pemakaian token AI pindah ke halaman sendiri, Pengaturan → AI → Pemakaian, dengan lebar yang sama seperti formulir koneksi, sehingga tombol Simpan tetap menjadi penutup formulir." },
    ],
  },
  {
    date: "2026-09-21",
    title: "Kalender: foto sales, saringan lokasi dan jenis, daftar hari bisa dikelompokkan",
    items: [
      { kind: "lebih-baik", text: "Di panel hari Kalender, tiap kunjungan kini memperlihatkan foto sales utamanya di ujung baris; namanya tetap tertulis. Berlaku juga di kalender publik (Jadwal tim)." },
      { kind: "baru", text: "Di samping pilihan Sales ada pilihan Lokasi dan Jenis. Isinya hanya lokasi dan jenis yang ada pada bulan itu. Angka di tiap tanggal ikut tersaring, dan saringan ini ikut di tautan kalender publik." },
      { kind: "baru", text: "Tombol kelompokkan di header panel hari menyusun daftar per lokasi atau per sales, dengan jumlah di tiap kelompok. Pilihan ini diingat seperti saringan lain dan ikut di tautan kalender publik." },
    ],
  },
  {
    date: "2026-09-21",
    title: "Tanya AI tahu jadwal dan laporannya, bukan hanya angkanya",
    items: [
      { kind: "lebih-baik", text: "Tanya AI kini juga diberi daftar di balik angka: aktivitas dan laporan pada periode yang disaring (klien, sales, jam, lokasi, hasil, peluang, next action), janji temu hari ini dan besok apa pun periodenya, prospek yang jatuh tempo, dan daftar sales. Jadi “kunjungan hari ini ke mana saja?” atau “siapa yang belum ada laporan?” bisa dijawab. Daftar yang panjang dipotong ke yang terdekat dengan hari ini dan AI menyebutkannya; semua tetap dibatasi cakupan lihatmu." },
      { kind: "lebih-baik", text: "Chip saran di Tanya AI diganti dengan pertanyaan yang memang bisa dijawab datanya." },
      { kind: "baru", text: "Pengaturan → AI punya kartu Pemakaian: token yang dipakai kedua aplikasi dalam 7 dan 30 hari terakhir, perkiraan seminggu dan sebulan dari laju terakhir, serta rinciannya per fitur dan per model. Angkanya token, harganya mengikuti tarif proxy." },
    ],
  },
  {
    date: "2026-09-20",
    title: "Pesan gangguan proxy AI yang terbaca",
    items: [
      { kind: "diperbaiki", text: "Saat server proxy AI tidak bisa dijangkau, Tanya AI dan Insight menampilkan halaman HTML mentah dari Cloudflare. Sekarang pesannya satu kalimat: server proxy atau tunnel-nya sedang mati, atau proxy sedang bermasalah, coba lagi sebentar lagi." },
    ],
  },
  {
    date: "2026-09-20",
    title: "Tanya AI menjawab lagi",
    items: [
      { kind: "diperbaiki", text: "Tanya AI tadi selalu gagal dengan pesan “EMPTY_ANSWER”: model diberi jatah jawaban yang terlalu kecil, dan pada proxy yang dipakai jatah itu juga menghitung proses berpikir model, jadi jawabannya kosong. Jatahnya kini mengikuti proxy, sama seperti Ask AI di LeadEngine yang memang lancar. Kalau model tetap tidak menjawab, pesannya sekarang kalimat yang jelas, bukan kode." },
      { kind: "diperbaiki", text: "Di ponsel, chip saran Tanya AI yang panjang tulisannya keluar dari kotaknya. Chip kini membesar mengikuti tulisannya, dan saran yang panjang dipersingkat." },
      { kind: "lebih-baik", text: "Pengaturan → AI: Simpan kini juga mengajukan satu pertanyaan singkat ke model fast dan model penalaran yang dipilih, jadi model yang terdaftar tapi tidak menjawab ketahuan di halaman pengaturan, bukan saat sales bertanya." },
    ],
  },
  {
    date: "2026-09-20",
    title: "Tanya AI di Ringkasan, dan insight yang lebih kaya",
    items: [
      { kind: "baru", text: "Tanya AI: tombol “Tanya AI” di baris saringan Ringkasan membuka panel samping (di ponsel: lembar dari bawah) untuk bertanya bebas tentang periode dan sales yang sedang disaring, misalnya “sales mana yang paling banyak laporan?” atau “industri apa yang paling sering dikunjungi?”. Jawabannya dihitung dari angka yang sama dengan kartu-kartu Ringkasan, jadi selalu bisa dicek, dan percakapan tetap ada saat panel ditutup. Nyalakan di Pengaturan → Aturan aktivitas → Insight AI; yang boleh bertanya mengikuti modul Insight AI di Role & Izin." },
      { kind: "lebih-baik", text: "Insight hari ini kini juga membaca jam tersibuk, industri terbanyak, hasil kunjungan dan klien yang paling sering, serta jadwal besok dan tujuh hari ke depan, sehingga di akhir pekan pun tetap ada 3 sampai 5 poin, bukan satu kalimat saja." },
      { kind: "lebih-baik", text: "Insight hari ini kini satu kartu di dalam papan Ringkasan, bukan spanduk di atasnya: bisa dipindah, diubah ukurannya, atau disembunyikan lewat Atur widget seperti kartu lain. Pertama kali muncul, kartu ini mengambil baris pertama selebar papan; isinya selalu tentang hari ini, tidak ikut periode yang disaring." },
    ],
  },
  {
    date: "2026-09-20",
    title: "Insight hari ini di Ringkasan, ditulis AI",
    items: [
      { kind: "baru", text: "Di atas Ringkasan Laporan ada kartu “Insight hari ini”: 3 sampai 5 kalimat tentang laporan yang masuk hari ini, laporan tertunda, prospek yang lewat tanggal hubungi lagi, dan perbandingan minggu ini dengan minggu lalu, ditulis AI dari angka yang sudah dihitung aplikasi. Poin yang bisa dijawab daftar bisa diketuk untuk membukanya." },
      { kind: "baru", text: "Dibuat otomatis tiap pagi pada jam yang diatur admin (bawaan 06.00 WIB) dan diperbarui saat ada laporan masuk, paling cepat 10 menit sekali. Admin bisa menekan Buat ulang. Kartu selalu menyebut kapan dibuat dan dari berapa laporan." },
      { kind: "baru", text: "Nyalakan di Pengaturan → Aturan aktivitas → Insight AI. Siapa yang melihatnya diatur di Role & Izin (LeadEngine), modul baru Insight AI: bawaan hanya admin dan atasan (cakupan Tim melihat insight timnya, Semua melihat unit); sales bisa diberi akses kapan saja, dan akan melihat insight tentang dirinya sendiri." },
    ],
  },
  {
    date: "2026-09-20",
    title: "Pengaturan AI: koneksi ke proxy diatur dari aplikasi",
    items: [
      { kind: "baru", text: "Pengaturan → AI: admin mengisi alamat endpoint proxy dan kunci API, menekan Uji koneksi untuk melihat model apa saja yang tersedia di endpoint itu, lalu memilih model cepat dan model analisis dari daftarnya. Kunci disimpan terenkripsi di Supabase Vault dan tidak pernah ditampilkan kembali; ganti kunci cukup dengan mengisi kolomnya lagi." },
      { kind: "baru", text: "Satu koneksi dipakai Sales Activity dan LeadEngine. LeadEngine langsung memakainya untuk Ask AI dan Analyze di dashboard; fitur AI di Sales Activity (insight harian di Laporan, ringkasan periode, tanya data) menyusul dengan saklarnya sendiri." },
    ],
  },
  {
    date: "2026-09-19",
    title: "Ringkasan: daftar per industri tidak lagi menyembunyikan sisanya",
    items: [
      { kind: "diperbaiki", text: "Kartu daftar di Ringkasan (misalnya Aktivitas per industri) hanya menampilkan 12 baris teratas dan diam-diam membuang sisanya, sehingga industri dengan sedikit aktivitas seolah tidak ada. Sekarang sisanya digabung menjadi satu baris “Lainnya (N industri)”, dan persentase dihitung dari total seluruhnya, bukan dari baris yang tampil saja." },
      { kind: "baru", text: "Tombol “Lihat semua” di kaki kartu membuka seluruh baris. Baris yang bisa dijawab oleh daftar bisa diketuk untuk membuka daftar itu, sudah tersaring baris dan periodenya: industri, jenis aktivitas, sales, dan klien membuka Aktivitas; sales, klien, hasil kunjungan, dan tingkat minat membuka Laporan (kartu peluang dan lead ikut menyaringnya). Baris seperti itu bertanda chevron di ujungnya. Prospek tidak bisa dibuka begini karena daftarnya belum punya saringan periode. Saat membuat widget, form menyebutkan kalau barisnya akan bisa diketuk." },
      { kind: "lebih-baik", text: "Batang di kartu daftar kini benar-benar batang: lebih tebal, sudut kecil, tanpa rel abu-abu di belakangnya, dan warnanya mengikuti ukuran yang ditampilkan (hijau untuk Aktivitas, biru untuk Laporan), sama seperti grafik batang di kartu lain. Sebelumnya tampak seperti indikator progres." },
    ],
  },
  {
    date: "2026-09-19",
    title: "Gaya komunikasi (DISC) pada kontak yang ditemui",
    items: [
      { kind: "baru", text: "Di laporan kunjungan, tiap kontak yang ditemui bisa diberi tipe DISC dari pelatihan: satu huruf Utama dan, kalau terlihat, satu huruf Pendamping, lalu catatan cara menghadapinya. Selalu opsional; begitu huruf dipilih, cara pendekatan dari materi pelatihan tampil sebagai pengingat." },
      { kind: "baru", text: "Hasilnya tampil sebagai lencana DISC di halaman aktivitas pada daftar Ketemu siapa, lengkap dengan siapa yang menilai dan kapan, sehingga rekan yang berkunjung berikutnya tahu cara menghadapi orang itu." },
      { kind: "baru", text: "Kunjungan berikutnya ke orang yang sama di perusahaan yang sama langsung terisi penilaian terakhir, ditandai “Dari kunjungan sebelumnya”; ubah kalau kesanmu berbeda. Penilaian juga ikut ke kontak di LeadEngine." },
      { kind: "baru", text: "Admin menyalakannya di Pengaturan → Aktivitas → Laporan kunjungan → Gaya komunikasi (DISC) pada kontak. Bawaan mati, jadi tim yang belum ikut pelatihan tidak melihatnya. Tidak pernah tampil di tautan publik atau ekspor." },
    ],
  },
  {
    date: "2026-09-19",
    title: "Tampilan komputer: pertanyaan hasil follow-up dan lebar kolom tabel",
    items: [
      { kind: "lebih-baik", text: "Di komputer, pertanyaan “Bagaimana hasilnya?” setelah menghubungi prospek kini tampil sebagai dialog di tengah layar dengan latar yang meredup, sama seperti di HP, sehingga tidak lagi menyerupai baris tabel." },
      { kind: "lebih-baik", text: "Di tabel Aktivitas dan Prospek, klik di mana saja pada baris untuk membuka datanya; nama perusahaan juga menjadi tautan. Panah kecil di ujung baris dihapus karena banyak yang tidak tahu itu bisa diklik." },
      { kind: "lebih-baik", text: "Kolom Sales utama kini menampilkan foto sales utama dan pendukungnya, sama seperti kartu di HP." },
      { kind: "diperbaiki", text: "Lebar kolom tabel Aktivitas dan Prospek ditata ulang: kolom Status dan Aksi tidak lagi menyisakan ruang kosong di laptop, dan nama perusahaan mendapat ruang lebih sehingga tidak terpotong." },
      { kind: "diperbaiki", text: "Di Kalender pada komputer, angka jumlah aktivitas di tiap tanggal tidak lagi terpotong ketika kartu kalendernya pendek; angka itu kembali ke pojok kanan atas sel. Di HP tetap di bawah tanggal." },
    ],
  },
  {
    date: "2026-09-19",
    title: "Rekaman pertemuan di laporan kunjungan",
    items: [
      { kind: "baru", text: "Form laporan punya field Rekaman pertemuan di kartu Lampiran. Rekam pertemuan dengan Memo Suara di iPhone (aplikasi bawaannya tahan layar terkunci dan telepon masuk), lalu ketuk Unggah rekaman dan pilih berkasnya. Atur sekali Kualitas Audio Memo Suara ke Terkompresi supaya satu jam hanya sekitar 30 MB. Maksimal 3 rekaman, 50 MB per berkas, dengan progres unggah yang terlihat." },
      { kind: "baru", text: "Di halaman aktivitas, rekaman bisa diputar langsung dan diunduh dengan nama aslinya, siap dimasukkan ke alat analisis percakapan seperti Fireflies. Hanya anggota unit bisnis yang sama yang bisa membukanya." },
      { kind: "baru", text: "Admin bisa menambahkan field Rekaman suara ke form aktivitas dan form prospek, serta mengganti label atau teks bantuan field Rekaman pertemuan di Pengaturan → Form laporan." },
      { kind: "lebih-baik", text: "Kartu Foto di form laporan kini bernama Lampiran karena memuat foto dan rekaman." },
    ],
  },
  {
    date: "2026-09-19",
    title: "Hubungi prospek langsung dari daftar",
    items: [
      { kind: "baru", text: "Tombol Catat kontak berganti menjadi Hubungi. Ketuk lalu pilih WhatsApp (chat terbuka dengan pesan pembuka yang sudah terisi), Telepon, atau Email. Di komputer, Telepon menyalin nomornya supaya bisa ditelepon dari HP." },
      { kind: "baru", text: "Begitu kembali ke aplikasi setelah menghubungi, muncul lembar “Bagaimana hasilnya?” dari bawah layar. Satu ketuk untuk Tersambung, Tidak diangkat, atau Nomor salah; hasil yang butuh tanggal atau alasan membuka form lengkap yang sudah terisi kanalnya. Ketuk Nanti kalau belum sempat." },
      { kind: "baru", text: "Admin bisa mengatur kalimat pembuka WhatsApp untuk unit bisnisnya di Pengaturan → Aktivitas → Prospek, dengan {sapaan}, {kontak}, {sales}, dan {perusahaan} sebagai isian otomatis." },
      { kind: "lebih-baik", text: "Form pencatatan kini bernama Catat follow-up dan tetap tersedia di menu Hubungi untuk mencatat kontak yang terjadi di luar aplikasi." },
      { kind: "lebih-baik", text: "Di kartu prospek, nama pemegang yang panjang disingkat (misalnya “Setyorini D. I.”) supaya tidak terpotong, dan baris “Belum pernah dihubungi” tidak lagi ditampilkan ketika statusnya sudah mengatakan itu." },
    ],
  },
  {
    date: "2026-09-18",
    title: "Form laporan kunjungan lebih lega di HP",
    items: [
      { kind: "diperbaiki", text: "Foto bukti kunjungan dan kartu nama kini ada di bagian “Foto” sendiri di akhir form. Sebelumnya bagian “Hasil kunjungan” muncul dua kali, di awal dan di akhir, dan terlihat seperti form mengulang." },
      { kind: "lebih-baik", text: "Di HP, bar bawah form hanya berisi status dan tombol Kirim laporan yang lebih lebar. Kembali lewat panah di kiri atas; Buang draf lewat menu ⋮ di kanan atas. Baris “Sales Mission · Lokasi” di atas form tidak lagi ditampilkan sehingga ruang untuk mengisi lebih luas." },
      { kind: "lebih-baik", text: "Keterangan di bawah beberapa field dipersingkat: satu baris untuk foto (batas dan apa yang difoto), tanpa kalimat “Kunjungan ke …” yang mengulang judul, dan kotak centang peluang kini langsung menyebut apa yang terjadi bila dicentang." },
    ],
  },
  {
    date: "2026-09-18",
    title: "Halaman masuk di HP",
    items: [
      { kind: "lebih-baik", text: "Di HP, form masuk kini mulai dari atas layar, sehingga kolom email dan kata sandi tetap terlihat saat keyboard muncul. Warnanya mengikuti warna halaman lain di aplikasi." },
    ],
  },
  {
    date: "2026-09-18",
    title: "Siapa yang pergi, terlihat di kartu",
    items: [
      { kind: "lebih-baik", text: "Di HP, kartu aktivitas kini menampilkan foto (atau inisial) sales utama dan pendukungnya di baris bawah, tepat di samping tombol Join, lengkap dengan nama sales utama. Sebelumnya nama hanya tertulis kecil di antara baris lain." },
      { kind: "lebih-baik", text: "Kartu prospek di HP menampilkan pemegang prospek dengan cara yang sama, di samping tombol Catat kontak." },
    ],
  },
  {
    date: "2026-09-18",
    title: "Kalender dan detail aktivitas di HP lebih rapi",
    items: [
      { kind: "diperbaiki", text: "Di Kalender HP, angka jumlah aktivitas tidak lagi menutupi tanggalnya; sekarang duduk di bawah angka tanggal." },
      { kind: "lebih-baik", text: "Di Kalender HP, Tautan publik dan Sinkron ke ponsel pindah ke menu ⋮ sehingga kalender dan jadwal hari terpilih langsung terlihat." },
      { kind: "lebih-baik", text: "Di halaman aktivitas di HP, tiap tindakan punya satu pintu: Ubah lewat ikon pensil di bawah atau menu ⋮, Join lewat tombol di bawah, dan Batalkan aktivitas dari menu ⋮. ID aktivitas dan baris ringkasan yang sudah ada di kartu fakta tidak lagi ditampilkan di HP." },
      { kind: "diperbaiki", text: "Kalimat “Laporan bisa diisi mulai …” tidak lagi muncul dua kali di kartu Laporan kunjungan." },
      { kind: "lebih-baik", text: "Tombol Tambah catatan tidak lagi abu-abu saat kolom kosong; ditekan tanpa isi, kolomnya yang disorot dengan pesan “Tulis pengamatan dulu.”" },
      { kind: "lebih-baik", text: "Label kecil di atas judul kartu (Laporan kunjungan, Tim aktivitas, Tampilan bulan, dan lainnya) tidak lagi huruf kapital semua, lebih mudah dibaca." },
    ],
  },
  {
    date: "2026-09-18",
    title: "Prospek, Laporan, dan Hari ini di HP mengikuti Aktivitas",
    items: [
      { kind: "lebih-baik", text: "Di HP, daftar Prospek dan Laporan sekarang langsung dimulai dari pencarian dan datanya. Import, Ekspor, dan Atur widget pindah ke menu ⋮ di pojok kanan atas; di komputer semuanya tetap di tempat semula." },
      { kind: "lebih-baik", text: "Kartu prospek lebih ringkas, dan kotak centangnya muncul hanya setelah menekan-tahan kartu atau memilih “Pilih prospek” dari menu ⋮." },
      { kind: "lebih-baik", text: "Tab Daftar/Ringkasan di Laporan kini menempel di bawah judul halaman." },
      { kind: "lebih-baik", text: "Di Hari ini, daftar Berikutnya dikelompokkan per tanggal sehingga nama klien tidak lagi terpotong oleh tanggal yang berulang di setiap baris." },
      { kind: "diperbaiki", text: "Aktivitas yang sudah dibatalkan tidak lagi tampil di daftar Berikutnya." },
      { kind: "lebih-baik", text: "Pilihan aktif pada tombol bersegmen (Hari ini / Minggu ini / Bulan ini, Umum / Per sales) kini berwarna biru muda, bukan biru penuh, supaya tidak tertukar dengan tombol aksi." },
    ],
  },
  {
    date: "2026-09-18",
    title: "Daftar Aktivitas di HP: langsung ke daftarnya",
    items: [
      { kind: "lebih-baik", text: "Di HP, kotak pencarian sekarang paling atas dan kartu aktivitas pertama muncul jauh lebih awal. Tombol Export dan Import pindah ke menu ⋮ di pojok kanan atas; di komputer keduanya tetap di tempat semula." },
      { kind: "lebih-baik", text: "Kartu aktivitas lebih ringkas: tanggal dan lokasi dalam satu baris, nama sales di bawahnya, sehingga tiga kartu muat dalam satu layar, bukan satu setengah." },
      { kind: "lebih-baik", text: "Kotak centang di kartu tidak lagi selalu tampil. Tekan dan tahan sebuah kartu, atau pilih “Pilih aktivitas” dari menu ⋮, untuk mulai memilih beberapa sekaligus; ketuk Batal untuk keluar." },
    ],
  },
  {
    date: "2026-09-18",
    title: "Join lebih aman dari salah ketuk",
    items: [
      { kind: "lebih-baik", text: "Tombol Join di daftar dan kartu aktivitas tidak lagi biru penuh, supaya tidak mudah terpencet saat menggulir di HP. Yang biru penuh hanya di halaman aktivitasnya sendiri." },
      { kind: "lebih-baik", text: "Setelah Join muncul pesan “Kamu bergabung ke kunjungan …” dengan tombol Batalkan selama beberapa detik. Kalau dibatalkan saat itu juga, sales utama dan tim tidak menerima notifikasi apa pun, seolah tidak pernah terjadi." },
    ],
  },
  {
    date: "2026-09-18",
    title: "Dua perbaikan tampilan di HP",
    items: [
      { kind: "diperbaiki", text: "Di HP, menggeser layar dari tengah daftar Jadwal di halaman Kalender tidak menggulir halaman; hanya sentuhan di tepi kartu yang berhasil. Sekarang halaman bergulir dari mana pun jempol Anda berada." },
      { kind: "diperbaiki", text: "Kartu kunjungan hari ini di halaman Hari ini bisa melebar melewati tepi layar kalau nama kliennya panjang, sehingga statusnya terpotong. Sekarang nama yang panjang dipotong dengan … dan kartunya selalu selebar layar. Aturan yang sama diterapkan ke semua tata letak kartu lain supaya tidak terulang." },
    ],
  },
  {
    date: "2026-09-18",
    title: "Filter Industri di daftar Aktivitas",
    items: [
      { kind: "baru", text: "Daftar Aktivitas kini bisa disaring per industri. Pilihan “Belum diisi” di paling atas menampilkan aktivitas yang industrinya masih kosong, supaya mudah dilengkapi dan laporan per industri jadi utuh." },
    ],
  },
  {
    date: "2026-09-18",
    title: "Catat kontak langsung menyarankan status yang benar",
    items: [
      { kind: "diperbaiki", text: "Saat form Catat kontak dibuka, Hasil sudah terisi “Tersambung” tetapi Status setelah ini masih menunjukkan status lama, misalnya Uncontacted. Kalau tidak diubah, prospek yang jelas sudah tersambung tersimpan seolah belum pernah dihubungi. Sekarang status langsung ikut menyarankan In Progress sejak form dibuka." },
    ],
  },
  {
    date: "2026-09-18",
    title: "Papan live di TV tampil baru",
    items: [
      { kind: "lebih-baik", text: "Papan live sekarang punya satu sorotan besar di atas: kunjungan yang sedang berlangsung, atau kunjungan berikutnya lengkap dengan hitung mundurnya, sehingga orang yang lewat langsung tahu apa yang terjadi." },
      { kind: "lebih-baik", text: "Progres hari ini tampil sebagai angka besar dengan bilah kemajuan, jadwal disusun sebagai garis waktu dengan tanda selesai, dan setiap sales punya lingkaran inisial berwarna di jadwal maupun di daftar tim." },
      { kind: "lebih-baik", text: "Saat semua kunjungan sudah selesai, papan mengatakannya dengan jelas alih-alih menyisakan tabel kosong." },
    ],
  },
  {
    date: "2026-09-18",
    title: "Tombol kirim laporan tidak lagi mati saat ada isian kurang",
    items: [
      { kind: "lebih-baik", text: "Di form laporan, tombol Kirim sekarang selalu bisa ditekan. Kalau masih ada yang kurang, menekannya langsung membawa Anda ke isian pertama yang kosong, sama seperti di form Aktivitas dan Prospek. Sebelumnya tombolnya diabukan, jadi tidak ada yang bisa ditanya kenapa." },
      { kind: "lebih-baik", text: "Waktu kunjungan yang masih di masa depan kini ikut disebut di atas tombol beserta tautan untuk memperbaikinya, bukan cuma mematikan tombolnya diam-diam." },
      { kind: "diperbaiki", text: "Melompat ke isian yang kosong tidak lagi menggeser seluruh halaman: judul di atas sempat terpotong dan muncul pita kosong di bawah, seolah tampilannya rusak. Sekarang yang bergerak hanya panel isi. Perbaikan yang sama berlaku untuk chip bagian di form panjang, daftar \u201cBelum lengkap\u201d, dan kotak merah di form Aktivitas dan Prospek." },
    ],
  },
  {
    date: "2026-09-18",
    title: "Papan live berhenti menghitung kunjungan yang batal",
    items: [
      { kind: "diperbaiki", text: "Kunjungan yang dibatalkan atau ditolak tidak lagi tampil di Papan live, dan yang lebih penting tidak lagi ikut dihitung. Sebelumnya satu kunjungan batal membuat papan menulis \u201c1 kunjungan · 1 orang di lapangan\u201d dan memunculkan nama salesnya di panel Tim, padahal tidak ada yang berangkat. Aturannya kini sama dengan Kalender: jadwal menampilkan yang akan terjadi, dan pembatalan dilihat di daftar Aktivitas." },
      { kind: "lebih-baik", text: "Sisa layar di bawah jadwal kini tetap bergaris sampai dasar, seperti papan keberangkatan sungguhan, jadi papan yang lengang terbaca sebagai \u201ctidak ada lagi hari ini\u201d dan bukan sebagai tampilan rusak." },
      { kind: "lebih-baik", text: "Nama klien mendapat ruang dua kali lipat dibanding kolom di sebelahnya sehingga tidak lagi terpotong, bilah atas dan tabel kini mulai pada garis yang sama, jam dinding dikecilkan agar tidak menyaingi jam kunjungan, dan penanda pratinjau tidak lagi berbentuk chip yang seolah bisa ditekan." },
    ],
  },
  {
    date: "2026-09-18",
    title: "Papan live dibaca seperti papan keberangkatan, dan jadwal untuk manajemen",
    items: [
      { kind: "baru", text: "Tautan jadwal publik: admin bisa membuat tautan dari halaman Kalender agar manajemen membuka jadwal tim di browser tanpa login. Isinya sama dengan Kalender — jam, klien, lokasi, sales — baca-saja, tanpa tombol apa pun, dan bisa disaring per sales. Tautannya rahasia dan bisa dicabut kapan saja." },
      { kind: "lebih-baik", text: "Pengaturan “Papan live” kini bernama “Tautan publik” dan memuat dua jenis tautan sekaligus: layar TV dan kalender manajemen. Tautan satu jenis tidak bisa dipakai untuk jenis yang lain." },
      { kind: "baru", text: "Papan live di TV kini satu tabel penuh layar dengan judul kolom Jam, Klien, Lokasi, Sales, dan Status: jam ditulis dengan angka selebar sama sehingga sejajar dari atas ke bawah, garis tipis antar baris menggantikan kotak-kotak, dan kunjungan yang sedang berlangsung ditandai satu baris biru dengan garis kuning di tepinya. Kunjungan yang sudah lewat meredup, jadi baris terang pertama adalah kunjungan berikutnya." },
      { kind: "lebih-baik", text: "Warna papan disederhanakan menjadi satu keluarga biru merek dengan satu aksen kuning; titik dan inisial berwarna-warni dihapus karena tidak menambah informasi dari jarak empat meter. Hurufnya diganti dengan huruf rujukan Material yang punya angka selebar sama." },
      { kind: "lebih-baik", text: "TV yang dipasang berdiri (potret) kini didukung: kolom Lokasi pindah ke bawah nama klien dan panel tim turun ke bawah jadwal, dengan ukuran huruf yang menyesuaikan." },
    ],
  },
  {
    date: "2026-09-18",
    title: "Ringkasan yang bisa disusun sendiri",
    items: [
      { kind: "baru", text: "Admin bisa menjadikan susunan Ringkasan di akunnya sebagai bawaan semua akun, lewat menu ⋯ di mode Atur widget. Orang yang sudah menyusun sendiri tetap dengan susunannya sampai memilih Kembali ke susunan awal." },
      { kind: "baru", text: "Kalender tim: atasan dan admin mendapat tautan langganan kedua di Kalender saya, berisi semua aktivitas yang boleh mereka lihat, dengan nama sales utama di depan judul acara. Kalender pribadi tetap hanya aktivitas yang Anda ikuti, dan halamannya kini mengatakan itu, serta mengingatkan untuk menempel sebagai kalender dari URL, bukan impor berkas." },
      { kind: "baru", text: "Ringkasan laporan kini berupa kartu: laporan per hari, laporan vs aktivitas, aktivitas vs prospek, tingkat minat, laporan per industri, dan daftar laporan per hari. Kata-katanya sama dengan menu: prospek adalah rencana, aktivitas adalah janji temu, laporan adalah kunjungan yang terjadi. Saring periode dan sales di atas; semua kartu mengikuti, dan kartu yang punya Umum / Per sales bisa diganti di tempat." },
      { kind: "baru", text: "Atur widget: geser kartu dari judulnya, tarik sudut kanan bawah untuk mengubah ukuran bebas pada grid 12 kolom (tiap kartu punya ukuran minimum), sembunyikan, tampilkan lagi. Susunan diingat per orang di semua perangkat." },
      { kind: "baru", text: "Widget baru: susun kartu sendiri dari ukuran (laporan, aktivitas, prospek, lead ke CRM, peluang, nilai estimasi), pengelompokan, pemecahan, dan bentuk grafik: batang tegak atau mendatar, bertumpuk, garis, area, donat, pai, tabel, angka, atau angka dengan tren. Bentuk yang tidak cocok dengan pengelompokannya tidak ditawarkan. Sampai 12 kartu per orang." },
      { kind: "lebih-baik", text: "Ringkasan dihitung di database untuk periode yang dipilih, bukan memuat semua laporan lalu menyaring. Angka utama, per klien, per jenis aktivitas, lead per kategori, dan corong prospek tetap ada sebagai widget yang bisa ditampilkan." },
    ],
  },
  {
    date: "2026-09-17",
    title: "Ditunda, jadwal menyusul",
    items: [
      { kind: "baru", text: "Tarik kembali laporan yang sudah dikirim: laporan kembali menjadi draf, aktivitas tidak lagi Selesai, versi terkirim tersimpan bersama alasannya. Haknya sama dengan Ubah laporan; lead yang sudah ke LeadEngine tetap di sana." },
      { kind: "baru", text: "Laporan kunjungan baru bisa diisi pada hari kunjungannya, dan waktu kunjungan tidak boleh di masa depan; sebelum itu halaman aktivitas menyebut tanggal laporannya terbuka. Admin bisa mematikan aturan ini di Pengaturan → Aktivitas → Laporan hanya setelah kunjungan." },
      { kind: "lebih-baik", text: "Halaman aktivitas: jadwal, lokasi, sales utama, industri, dan tujuan tampil sebagai baris properti, bukan empat kolom yang ikut memanjang saat alamatnya panjang. Nilainya memakai huruf biasa, bukan tebal." },
      { kind: "baru", text: "Kalender punya saringan siapa: chip Semua dan Saya, serta pilihan Sales untuk satu atau beberapa orang, sama seperti di daftar Aktivitas. Angka di tanggal, chip, dan panel hari mengikutinya, dan pilihan terakhir diingat per orang." },
      { kind: "diperbaiki", text: "Kalender tidak lagi menampilkan aktivitas yang dibatalkan atau ditolak; cari lewat filter Status di daftar Aktivitas." },
      { kind: "lebih-baik", text: "Kalender pas satu layar di desktop: bulan mengisi tinggi layar, panel jadwal hari terpilih sejajar di sampingnya dan hanya daftarnya yang menggulir." },
      { kind: "diperbaiki", text: "Pengaturan → Aktivitas bisa disimpan lagi. Sejak Riwayat perubahan ditambahkan, setiap simpan gagal karena pencatatan riwayat mengharapkan kolom id yang tidak dimiliki tabel pengaturan." },
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
