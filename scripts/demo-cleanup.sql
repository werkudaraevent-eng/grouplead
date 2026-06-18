-- ============================================================
--  DEMO DATA CLEANUP — LeadEngine
--  Tujuan: bersihkan SEMUA data trial (leads + contacts +
--  client companies) sebelum import ulang dengan file rapi.
--
--  AMAN untuk migrasi: ini hanya menghapus ISI tabel (data),
--  TIDAK menyentuh struktur / FK / tabel supabase_migrations.
--
--  Cara pakai:
--    Supabase Dashboard → SQL Editor → tempel → Run.
--
--  Catatan cascade (otomatis ikut terhapus, tidak perlu
--  dihapus manual):
--    - Hapus leads  → lead_activities, lead_notes,
--      lead_stage_history, lead_checklists, lead_attachments,
--      lead_tab_views, goal lead links  (semua ON DELETE CASCADE)
--    - Hapus contacts → contact_activities (CASCADE)
--    - Hapus client_companies → company_activities (CASCADE)
--      DAN contacts di bawahnya (CASCADE)
-- ============================================================

-- ----- LANGKAH 1 (opsional): lihat jumlah data SEBELUM hapus -----
-- Jalankan blok ini sendiri dulu kalau mau cek angkanya.
SELECT
  (SELECT count(*) FROM public.leads)            AS leads,
  (SELECT count(*) FROM public.contacts)         AS contacts,
  (SELECT count(*) FROM public.client_companies) AS client_companies;


-- ----- LANGKAH 2: hapus data (urutan aman, dibungkus transaksi) -----
-- Kalau ada satu yang gagal, SEMUA dibatalkan (tidak setengah jalan).
--
-- CATATAN: ada trigger audit (audit_company_notes / audit_contact_notes /
-- lead activity) yang AFTER DELETE mencoba menulis log ke tabel *_activities
-- yang me-refer ke induk yang BARU SAJA terhapus → FK violation.
-- Maka trigger audit dimatikan sementara selama cleanup, lalu dinyalakan lagi.
BEGIN;

  -- Matikan SEMUA trigger user di 3 tabel induk + tabel notes-nya,
  -- supaya cascade-delete tidak memicu audit yang gagal.
  ALTER TABLE public.client_companies DISABLE TRIGGER USER;
  ALTER TABLE public.contacts         DISABLE TRIGGER USER;
  ALTER TABLE public.leads            DISABLE TRIGGER USER;
  ALTER TABLE public.company_notes    DISABLE TRIGGER USER;
  ALTER TABLE public.contact_notes    DISABLE TRIGGER USER;
  ALTER TABLE public.lead_notes       DISABLE TRIGGER USER;

  -- 1) Leads dulu — anak-anaknya ikut terhapus via CASCADE.
  DELETE FROM public.leads;

  -- 2) Contacts — contact_activities ikut via CASCADE.
  DELETE FROM public.contacts;

  -- 3) Client companies — company_activities ikut via CASCADE.
  DELETE FROM public.client_companies;

  -- Bersihkan sisa baris audit (kalau ada yang yatim).
  DELETE FROM public.company_activities;
  DELETE FROM public.contact_activities;
  DELETE FROM public.lead_activities;

  -- Nyalakan kembali trigger.
  ALTER TABLE public.client_companies ENABLE TRIGGER USER;
  ALTER TABLE public.contacts         ENABLE TRIGGER USER;
  ALTER TABLE public.leads            ENABLE TRIGGER USER;
  ALTER TABLE public.company_notes    ENABLE TRIGGER USER;
  ALTER TABLE public.contact_notes    ENABLE TRIGGER USER;
  ALTER TABLE public.lead_notes       ENABLE TRIGGER USER;

COMMIT;


-- ----- LANGKAH 3 (opsional): verifikasi sudah kosong -----
SELECT
  (SELECT count(*) FROM public.leads)            AS leads,
  (SELECT count(*) FROM public.contacts)         AS contacts,
  (SELECT count(*) FROM public.client_companies) AS client_companies;
