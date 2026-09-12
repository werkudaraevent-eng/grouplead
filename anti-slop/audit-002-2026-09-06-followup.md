# Audit 002 — laporan tindak lanjut

**Tanggal:** 2026-09-06
**Keputusan:** "kerjakan semuanya" — seluruh 14 nomor dikerjakan.

---

## Berkas yang berubah

| Berkas | Nomor |
|---|---|
| `supabase/migrations/20260906120000_permissions_matrix_integrity.sql` (baru) | 1, 4, 10 |
| `contexts/permissions-context.tsx` | 2 |
| `lib/require-permission.ts` | 2 |
| `../sales-mission/lib/sales-mission-access.ts` | 2 |
| `features/roles/components/create-role-modal.tsx` | 3, 8, + hapus-senyap |
| `app/globals.css` | 5, 6 |
| `components/ui/switch.tsx` | 6 |
| `app/(app)/settings/permissions/page.tsx` | 7, 8, 9, 10, 11, 12, 13, 14 |

---

## Ringkasan per nomor

**1. Baris eksplisit untuk setiap (perusahaan, role, modul).** Migrasi langkah 4, dua pernyataan. Nilainya dipilih supaya akses efektif hari ini tidak berubah: sub-modul Sales Mission mewarisi baris induk (karena `canPerform` fail-open hari ini), modul lain mewarisi baris `user_type` yang namanya cocok dengan role, sisanya mati semua.

Satu bug di draf pertama saya sendiri: sub-modul membaca baris induk di dalam pernyataan INSERT yang juga membuat baris induk itu. `INSERT ... SELECT` melihat tabel sebelum pernyataan berjalan, jadi induk menyala sementara empat anaknya mati. Dipecah jadi 4a dan 4b.

**2. Fallback `user_type` dipersempit ke profil tanpa `role_id`.** Tiga tempat, sekarang memakai syarat yang sama: `permissions-context.tsx`, `require-permission.ts`, `sales-mission-access.ts` (dua fungsi). Sebelumnya klien jatuh all-or-nothing dan server jatuh per modul, jadi menyalakan sakelar pertama pada role baru mengubah resolver mana yang berkuasa.

**3. "Mulai dari" saat membuat role.** Pilihan: matriks kosong, atau salin izin dari role mana pun yang ada. Setelah role dibuat, barisnya langsung ditulis untuk semua perusahaan dalam cakupan, jadi "role tanpa baris" tidak lagi terjadi.

**4. CHECK constraint.** `can_read <> 'none' OR NOT (can_create OR can_update OR can_delete)`. Baris lama yang melanggar diperbaiki lebih dulu dengan mematikan tulisnya, bukan menyalakan bacanya: menyalakan baca akan memberi modul yang sebelumnya tidak mereka punya.

**5. `--muted-foreground` #8a95a1 → #5F6B77.** Terukur: 5.45:1 di kartu putih, 5.03:1 di #f4f6f8, 4.74:1 di halaman #EFEFEF. Modifier `/80` dan `/70` dibuang, bukan dikecilkan.

**6. Sakelar mati.** Token baru `--switch-off: #7B8795`. Diverifikasi di CSS terkompilasi aplikasi: track render `rgb(123, 135, 149)`, 3.66:1 terhadap kartu putih. `--input` tidak diubah karena juga dipakai sebagai `border-input` di setiap input, select, dan textarea.

**7. Lihat jadi kolom pertama.** Urutan sekarang: Modul, Lihat, Buat, Ubah, Hapus, Set cepat.

**8. Satu bahasa.** Header kolom, judul halaman, subtitle, deskripsi tiap modul, judul grup, semua empty state, dialog hapus, dan seluruh toast di kedua berkas.

**9. Header kolom benar-benar menempel.** Kontainer dibatasi `max-h-[70vh] overflow-auto`, `sticky` pindah ke sel `<th>` dengan latar buram.

**10. Modul mati.** `users` dan `forecast_settings` dihapus lewat migrasi. Halaman juga menyaringnya sendiri lewat `RETIRED_MODULE_IDS`, supaya benar sebelum migrasi dijalankan. Modul tak berkelompok kini punya judul sendiri.

**11. Semua grup bisa dilipat.** Plus `aria-expanded` dan `aria-controls`. Sebelumnya dua dari tiga header adalah tombol yang bisa difokus tapi tidak melakukan apa-apa.

**12. Cascade tidak lagi mengosongkan tabel.** `fetchPermissions(showLoading = false)`.

**13. Sakelar bergerak saat diklik.** Update optimistis dengan rollback ke state sebelumnya kalau server menolak.

**14. Set cepat per baris.** Mati / Lihat / Penuh.

---

## Delivery Gate

**Block 1 — Hard Gate**

| Aturan | Hasil | Bukti |
|---|---|---|
| R-02 em dash | PASS | Tidak ada `—` di string UI yang ditulis |
| R-03 mobile | PASS | Tabel dalam kontainer `overflow-auto`; tidak ada lebar tetap baru |
| R-25 kontras | PASS | Diukur: 5.45 / 5.03 / 4.74 / 3.66 / 10.86 / 7.98 |
| R-26 kontrol mati | PASS | Tidak ada lagi sakelar `disabled` tanpa alasan; C/U/D hidup semua |
| R-27 state | PASS | Loading, kosong (role/modul), dan error semua ada |
| R-32 keyboard | PASS | Keempat sakelar punya `aria-label`; header grup punya `aria-expanded` + `aria-controls`; tombol preset punya `aria-label` |
| R-35 verifikasi | PASS | tsc 0, 372 test, build 0 (LE); tsc 0, 221 test, build 0 (SM); migrasi lolos parser Postgres |
| R-38 konten jujur | PASS | Dialog hapus menghitung pengguna sungguhan; toast hanya muncul setelah baris benar-benar tertulis |

**Block 4 — Craftsmanship**

| Kriteria | Hasil |
|---|---|
| C-1 setiap keputusan punya alasan | PASS, alasan ditulis di komentar tiap perubahan |
| C-2 kontrol berfungsi | PASS, header grup yang dulu mati kini benar-benar melipat |
| C-5 klaim = kenyataan | PASS, "Force Delete" dan janji penjagaan yang tidak ada sudah dibuang |

---

## Belum dijalankan

Migrasi **belum diterapkan ke database**. Berkasnya lolos parser Postgres (10 pernyataan), tapi menjalankannya mengubah izin pengguna sungguhan dan tidak bisa dibatalkan. Docker mati saat pekerjaan ini selesai, jadi belum diuji di database lokal.

Urutan yang benar saat menerapkan: **migrasi dulu, baru deploy kode.** Kode yang mempersempit fallback `user_type` bergantung pada baris yang ditulis migrasi ini.
