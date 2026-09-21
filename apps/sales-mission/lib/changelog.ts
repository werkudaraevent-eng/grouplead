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
