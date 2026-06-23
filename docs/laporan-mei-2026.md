# Laporan Pengembangan Platform LeadEngine — Mei 2026

**Periode:** 1–31 Mei 2026
**Total commit:** 104
**Repositori:** werkudaraevent-eng/grouplead

## Ringkasan Eksekutif

Sepanjang Mei 2026, pengembangan LeadEngine difokuskan pada penyempurnaan
dashboard analitik, fitur impor data berskala besar, manajemen lead (pipeline),
pengelolaan pengguna & hak akses, serta persiapan kesiapan rilis (launch
readiness). Total **104 perubahan** tercatat: 40 fitur baru (`feat`), 50
perbaikan (`fix`), dan sisanya penyempurnaan UI/UX, refactor, dan optimasi
performa.

Distribusi pekerjaan per jenis:

| Jenis | Jumlah | Keterangan |
|---|---|---|
| Perbaikan (fix) | 50 | Koreksi bug, stabilisasi, polesan |
| Fitur baru (feat) | 40 | Kemampuan baru platform |
| Penyempurnaan UI (refine/ux/style) | 8 | Perbaikan tampilan & pengalaman pakai |
| Refactor & performa | 3 | Kualitas kode & kecepatan |
| Lainnya (revert/merge) | 3 | Pembatalan & penggabungan |

---

## Pekerjaan per Tema

### 1. Dashboard & Visualisasi Data (paling intensif)

Perombakan besar dashboard manajemen agar lebih bersih, informatif, dan enak
dibaca oleh manajemen.

- Redesain kartu KPI agar minimalis dan langsung berbicara ke manajemen.
- Modernisasi UI dashboard + perbaikan perilaku perbandingan tahun (revenue
  compare-year).
- Dukungan **multi-view**: pengguna bisa menyimpan beberapa tampilan dashboard
  bernama, dengan custom widget terisolasi per tampilan.
- Redesain widget: Sales Performance, Top Revenue, Pipeline (jadi funnel),
  Revenue Chart (warna bar kondisional + strip pencapaian YTD), Classification,
  Stream, dan Lead Source.
- Perbaikan grafik: sumbu-X lengket (sticky) pada grafik batang horizontal,
  penataan posisi bar agar sejajar label bulan, garis target lebih rapi.
- Filter rentang tanggal, scrollbar tipis, kartu KPI keenam, dan ekspor cetak
  (print export) dashboard.

### 2. Impor Data (Smart Import)

Pembangunan alur impor data lead berskala besar dengan validasi cerdas.

- Smart import + penentuan cakupan pipeline pada dashboard + editor stage inline.
- Pencocokan nama PIC Sales secara fuzzy agar lead hasil impor tidak jatuh ke
  "Unassigned".
- Penanganan tanggal: ambil `month_event` dari tanggal akhir dengan cut-off,
  pembatasan tahun 1900–9999 untuk mencegah error timezone Postgres.
- Pemisahan sel destinasi multi-kota & normalisasi terhadap master options.
- Pemisahan peringatan (warning) dari kegagalan nyata di panel hasil.
- Pengamanan modal: tidak bisa ditutup (klik luar / Esc) selama proses impor
  berjalan.
- Ekspos kolom tanggal closing & alasan lost di impor standar.

### 3. Manajemen Lead / Pipeline

- Editor stage inline dengan peringatan transisi mundur.
- Status akun per-lead dengan nilai default terhitung otomatis.
- Klik baris di tabel langsung membuka quick-edit sheet.
- Mode tampilan (view mode) yang tersimpan lewat URL + localStorage.
- Tab "Files": unggah, daftar, unduh, hapus berkas pada lead.
- Filter tanggal acara (mulai, selesai, hari mana saja) + filter Bulan
  Pengakuan Pendapatan (Revenue Recognition Month).
- Ekspor PDF lead sebagai dokumen terisi (form-filled), beralih dari jsPDF ke
  print-to-PDF berbasis HTML.
- Badge notifikasi pada tab detail lead; auto-save saat klik di luar dengan
  konfirmasi discard.
- Sort kanban yang bisa dipilih pengguna & tersimpan; perbaikan drag-reorder.

### 4. Pengguna, Hak Akses & Perusahaan

- Penegakan hierarki permission (RBAC) dan penyembunyian menu Settings dari
  pengguna Sales.
- Hak buat & ubah lead untuk peran Sales.
- Manajemen pengguna: filter peran/status/unit bisnis, aksi nonaktifkan & hapus
  pengguna, toggle holding cerdas untuk penugasan unit bisnis.
- Deep-link Company Management → User Management dengan filter unit bisnis.
- Halaman detail perusahaan dengan unggah logo + tombol Edit.
- Profil pengguna: avatar/bio + halaman riwayat audit (audit history).
- Wiring audit log ke aksi lead & pengguna.

### 5. Riwayat & Audit

- Sinkronisasi history, PIC & due date untuk lead tasks, `received_date`, dan
  layout self-heal.
- Edit brief/SOW/remarks kini muncul di history global.

### 6. Branding, Kesiapan Rilis & Fondasi Teknis

- Penerapan warna brand Werkudara Group ke seluruh platform + favicon.
- Polesan kanban & tabel, modal transisi, dokumen kesiapan rilis (launch
  readiness).
- Header cache defensif + service worker kill-switch (mencegah UI basi).
- Pencegahan FOUC pada sidebar dengan skeleton saat memuat permission.
- Build TypeScript strict, pembersihan proyek, paralelisasi pengambilan data
  (performa), dan top loading bar untuk transisi halaman.

---

## Rincian Aktivitas Harian

| Tanggal | Jumlah commit | Fokus utama |
|---|---|---|
| 4 Mei | 27 | Redesain widget dashboard, manajemen pengguna/perusahaan, brand colors, performa |
| 5 Mei | 8 | Redesain kartu KPI, header dashboard, impor historis |
| 6 Mei | 1 | Standarisasi tipografi Deal Info |
| 7 Mei | 14 | Detail perusahaan + logo, profil & audit history, permission Sales |
| 8 Mei | 2 | Sembunyikan Settings dari Sales, toolbar header lead |
| 11 Mei | 4 | Cache defensif, perbaikan sidebar (FOUC, History nav) |
| 12 Mei | 14 | Multi-view dashboard, ekspor PDF lead, auto-save editor, kanban sort |
| 13 Mei | 6 | Sticky x-axis grafik, custom widget grid |
| 15 Mei | 5 | Editor stage inline, status akun per-lead, quick-edit |
| 18 Mei | 17 | Smart import (validasi tanggal, fuzzy PIC, multi-kota), filter event-date |
| 19 Mei | 3 | Tab Files (upload/download/delete), sinkronisasi history |
| 28 Mei | 2 | Penegakan permission, polesan launch readiness |
| 29 Mei | 1 | Modernisasi UI dashboard + revenue compare-year |

---

## Catatan

- Laporan disusun dari riwayat commit Git (branch `main`), periode 1–31 Mei 2026.
- Penomoran PR (#1–#22) menunjukkan banyak pekerjaan melewati alur review
  pull-request, terutama pada rangkaian fitur impor data (18 Mei).
