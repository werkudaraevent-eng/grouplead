# LeadEngine Launch Readiness Phase Plan

Tanggal: 2026-05-28  
Tujuan launch: **digital adoption release** — user mulai pindah dari Excel ke LeadEngine untuk input, tracking, dan monitoring operasional dasar.

> Dashboard launch awal = operational monitoring. Forecast, goal variance, snapshot reporting, dan advanced management analytics masuk phase berikutnya.

---

## Prinsip Eksekusi

- [ ] Freeze fitur baru sampai launch selesai.
- [ ] Fix hanya blocker keamanan, stabilitas, performa, data flow, dan onboarding.
- [ ] Sembunyikan atau beri label beta untuk fitur yang belum reliable.
- [ ] Jangan rewrite besar sebelum launch.
- [ ] Setelah setiap item selesai, centang checkbox dan tambah catatan singkat bila perlu.

---

## Status Legend

- `[ ]` belum mulai
- `[x]` selesai
- `[~]` ongoing / partial
- `[!]` blocked / perlu keputusan

---

# Phase 0 — Scope Freeze & Launch Positioning

Target waktu: malam ini, 30–60 menit  
Owner: Product / Tech Lead

## Tujuan

Kunci scope launch agar besok tidak menjanjikan fitur yang belum siap.

## Checklist

- [ ] Tetapkan launch sebagai **internal digital adoption release**.
- [ ] Komunikasikan dashboard sebagai **operational monitoring**, bukan final management reporting.
- [ ] Freeze semua fitur baru sampai minimal H+1 launch.
- [ ] Tandai fitur berikut sebagai beta / hidden:
  - [ ] Goal Forecast
  - [ ] Goal Variance
  - [ ] Advanced Goal Attainment
  - [ ] Snapshot Reporting
  - [ ] Automation / Workflow
- [ ] Buat known limitations note untuk management dan pilot users.

## Acceptance Criteria

- [ ] Semua stakeholder paham: launch besok fokus pindah dari Excel ke digital.
- [ ] Tidak ada ekspektasi bahwa forecast/goal sudah final.

---

# Phase 1 — P0 Safety Fixes Before Launch [~]

Target waktu: malam ini  
Owner: Engineering

## 1. Security: Remove Hardcoded E2E Credentials

File:
- `e2e/dashboard.spec.ts`

Checklist:

- [!] Rotate password akun test yang pernah hardcoded. **Owner manual: admin Supabase/auth.**
- [x] Ganti credential Playwright menjadi env variable:
  - [x] `E2E_EMAIL`
  - [x] `E2E_PASSWORD`
- [~] Buat `.env.test` lokal. **Template tersedia: `.env.test.example`; isi real credential lokal saja.**
- [x] Pastikan `.env.test` masuk `.gitignore`.
- [x] Pastikan tidak ada credential hardcoded lain via search.

Acceptance:

- [x] Playwright login test tidak memuat email/password langsung di source code.
- [!] Password lama sudah tidak valid. **Manual confirmation required setelah rotate.**

---

## 2. Performance: Dashboard Safe Mode

File:
- `src/app/page.tsx`

Masalah:
- Dashboard query load semua leads tanpa limit.

Checklist:

- [x] Tambahkan limit awal dashboard query, rekomendasi `5000` records.
- [x] Tambahkan UI warning jika data ditampilkan terbatas.
- [x] Pastikan KPI tidak crash saat records kosong. **Typecheck/build pass; runtime empty-data masih perlu smoke test.**
- [ ] Test dashboard dengan data pilot.

Acceptance:

- [ ] Dashboard load stabil pada data pilot.
- [x] Dashboard tidak berpotensi load unlimited leads.

---

## 3. Trust: Hide / Beta Unstable Goal Widgets

Checklist:

- [x] Identifikasi widget goal yang belum reliable.
- [ ] Hide widget berikut dari default dashboard:
  - [x] Goal Forecast
  - [x] Goal Variance
- [ ] Jika tetap ditampilkan, tambahkan label jelas:
  - [ ] `Beta`
  - [ ] `Not for final reporting`
- [x] Pastikan management dashboard tidak menampilkan angka forecast misleading.

Acceptance:

- [x] Dashboard tidak memicu keputusan salah dari forecast/goal yang belum matang.

---

## 4. Permission & RLS Manual Smoke Test

Checklist role:

- [ ] Admin bisa access dashboard, leads, companies, contacts, settings sesuai scope.
- [ ] Sales bisa input/update leads sesuai permission.
- [ ] Viewer/read-only tidak bisa mutation.
- [ ] Subsidiary user hanya lihat data company sendiri.
- [ ] Holding user hanya lihat data sesuai expected holding access.
- [ ] User tanpa permission dashboard melihat restricted state.

Acceptance:

- [ ] Tidak ada cross-company data leak.
- [ ] Tidak ada role yang bisa aksi di luar permission.

---

## 5. Production Build Sanity

Checklist:

- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Catat lint status jika `npm run lint` masih punya pre-existing issue.

Lint status 2026-05-28:
- `npm run lint` **fails** with 495 existing problems: 273 errors, 222 warnings.
- Main classes: `no-explicit-any`, unused imports, React Compiler hook rules (`set-state-in-effect`, `preserve-manual-memoization`).
- Not launch blocker for tomorrow because `typecheck`, unit tests, and production build pass.
- Keep as Week 2 hardening item unless lint is enforced in deployment CI.

Acceptance:

- [x] Typecheck pass.
- [x] Unit tests pass.
- [x] Production build pass.

---

# Phase 2 — Excel Adoption & Data Migration Readiness

Target waktu: malam ini sampai besok pagi  
Owner: Admin Data / Engineering Support

Status 2026-05-28:
- Sample file found: `sample/Lead 2026.xlsx`.
- Sheet: `Recap`, 189 rows total.
- Header row appears at row 1.
- First data row starts at row 2.
- Detailed sample audit created: `docs/launch-import-sample-audit.md`.
- Import alias coverage looks good for key headers: `BU REVENUE`, `COMPANY`, `MAIN COMPANY`, `DATE OF EVENT`, `NAME OF PROJECT`, `GRADE LEAD`, `MAIN STREAM`, `TIPE STREAM`, `BUSINESS PURPOSE`, `TYPE`, `NO. OF PAX`, `NATIONALITY`, `VENUE/ HOTEL`, `LOKASI (NAMA KOTA)`, `STATUS`, `CANCEL/ LOST/ POST REASON`, `DATE CXL/ LOST`, `PIC SALES`, `SOURCE LEAD`.

Known sample import risks:
- `MONTH EVENT` and `START DATE` are Excel serial dates; date parser should handle, but must verify import preview.
- `DATE OF EVENT` has ranges like `26 - 29 Jan 26` and `1- 5 Feb 26`; verify parsed start/end.
- `STATUS` values include `MATERIALIZED`, `CONFIRMED`, `TENTATIVE`; confirm stage mapping before import.
- `PIC SALES` values are names like `KENSRIE`, `IRVANI`, `NINDY`; must match `profiles.full_name` or mapping may miss.
- `COMPANY` vs `MAIN COMPANY` may create/resolve client companies differently; sample uses both.
- Multi-city values exist, e.g. `YOGYAKARTA, GARUT, BOGOR, SEMARANG`; verify destination parsing.

Unique values requiring setup/mapping:
- `BU REVENUE`: `WNS` 114, `TEE` 59, `IHS` 12, `FAC` 3.
- `STATUS`: `LOST` 73, `TENTATIVE` 52, `MATERIALIZED` 49, `POSTPONED` 5, `TURNDOWN` 5, `CANCELLED` 2, `CONFIRMED` 2.
- `PIC SALES`: `IRVANI` 59, `KENSRIE` 56, `ELFASA` 29, `ADIEL` 10, `EMY` 8, `MITHA` 7, `NINDY` 6, plus smaller-volume names.
- `SOURCE LEAD`: `DIRECT - PHONE` 79, `DIRECT - EMAIL` 34, `TELEMARKETING` 34, plus referral/search/social/fair/website sources.

## Tujuan

User bisa mulai kerja dari LeadEngine, bukan Excel.

## Master Data Checklist

- [ ] Pipelines siap. **Manual app check.**
- [ ] Pipeline stages siap dan urutan benar. **Must include mapping for MATERIALIZED / CONFIRMED / TENTATIVE.**
- [ ] Lead sources siap. **Sample values include TELEMARKETING, GOOGLE, DIRECT - EMAIL, DIRECT - PHONE, REFERENSI - KLIEN.**
- [ ] Industry/classification options siap. **Sample fields: SECTOR, LINE INDUSTRY, AREA, MAIN STREAM, TIPE STREAM, BUSINESS PURPOSE, TYPE.**
- [ ] Sales users/PIC siap. **Confirm KENSRIE, IRVANI, NINDY, and all real PIC names exist.**
- [ ] Client companies siap. **Can be created during import, but duplicate review needed.**
- [ ] Contacts siap. **Sample does not show contact person in first rows; confirm if later columns include contacts.**
- [ ] Company scoping benar. **Confirm imported rows land in correct subsidiary from BU REVENUE.**

## Import Sample Checklist

- [ ] Import sample 20–50 rows from `sample/Lead 2026.xlsx`.
- [~] Header mapping benar. **Static alias audit done; verify in UI preview.**
- [ ] Stage mapping benar. **Map MATERIALIZED / CONFIRMED / TENTATIVE explicitly.**
- [ ] Date parsing benar. **Verify Excel serial + text ranges.**
- [ ] Phone normalization benar. **If file has phone columns; first sample rows do not show phone.**
- [ ] Duplicate hints muncul sesuai harapan. **Especially COMPANY vs MAIN COMPANY.**
- [ ] Import warnings bisa dipahami admin.
- [ ] Imported records muncul di leads list.

## Production Import Checklist

- [ ] Mulai dari batch kecil, bukan semua data langsung.
- [ ] Pilih 1 pipeline / 1 team / 1 periode sebagai pilot. **Recommendation: first 20–50 rows from Recap only.**
- [ ] Cocokkan total row Excel vs imported.
- [ ] Review records dengan missing PIC.
- [ ] Review records dengan missing stage.
- [ ] Review records dengan missing company/contact.
- [ ] Review date yang terlihat aneh.
- [ ] Review duplicate suspicious.

## Acceptance Criteria

- [ ] User pilot bisa menemukan leads mereka.
- [ ] User bisa search/filter leads.
- [ ] User bisa update status/stage.
- [ ] Admin bisa koreksi data hasil import.

---

# Phase 3 — Pre-Launch Smoke Test

Target waktu: besok pagi, 60–90 menit  
Owner: QA / Product / Engineering

## Admin Flow

- [ ] Login admin.
- [ ] Buka dashboard.
- [ ] Buka leads.
- [ ] Add lead.
- [ ] Edit lead.
- [ ] Change stage.
- [ ] Add client company.
- [ ] Add contact.
- [ ] Assign PIC.
- [ ] Confirm dashboard update.

## Sales Flow

- [ ] Login sales.
- [ ] Buka leads.
- [ ] Filter own leads.
- [ ] Update stage/status.
- [ ] Edit permitted fields.
- [ ] Confirm tidak bisa access settings sensitive.

## Management Flow

- [ ] Login management viewer.
- [ ] Buka dashboard.
- [ ] Review KPI dasar:
  - [ ] Total Leads
  - [ ] Pipeline Value
  - [ ] Won Revenue
  - [ ] Stage Breakdown
  - [ ] Top Revenue
  - [ ] Sales Performance basic
- [ ] Pastikan tidak ada widget beta yang misleading.

## Import Flow

- [ ] Upload Excel sample.
- [ ] Header mapping benar.
- [ ] Stage mapping benar.
- [ ] Import berhasil.
- [ ] Data muncul di leads list.

## Acceptance Criteria

- [ ] Semua critical user flow pass tanpa engineering intervention.

---

# Phase 4 — Launch Day Controlled Rollout

Target waktu: besok  
Owner: Product / Support / Engineering

## Batch 1 — Pilot Users

Target user:
- [ ] 1 admin
- [ ] 2 sales
- [ ] 1 management viewer

Checklist:

- [ ] Pilot users bisa login.
- [ ] Pilot users bisa menemukan data masing-masing.
- [ ] Pilot users bisa create/update lead.
- [ ] Pilot users paham dashboard masih operational view.
- [ ] Semua issue dicatat di issue log.

Acceptance:

- [ ] Tidak ada P0/P1 issue selama 2–3 jam pertama.

---

## Batch 2 — Team Kecil

Checklist:

- [ ] Expand ke 1 divisi / 1 pipeline.
- [ ] Monitor login dan create/update lead.
- [ ] Monitor dashboard load time.
- [ ] Monitor data confusion dari hasil import.

Acceptance:

- [ ] Team kecil bisa kerja tanpa balik total ke Excel.

---

## Batch 3 — Full Users

Checklist:

- [ ] Jalankan hanya jika Batch 1 dan Batch 2 stabil.
- [ ] Share short user guide.
- [ ] Share support channel.
- [ ] Lock Excel sebagai backup, bukan source kerja harian.

Acceptance:

- [ ] Mayoritas user mulai input/update di LeadEngine.

---

# Phase 5 — Launch Support War Room

Target waktu: launch day  
Owner: Support Lead

## Issue Log Format

Buat tracker dengan kolom:

- [ ] Time
- [ ] User
- [ ] Module
- [ ] Issue
- [ ] Severity
- [ ] Screenshot / screen recording
- [ ] Data row / URL
- [ ] Status
- [ ] Owner
- [ ] Fix ETA

## Severity Definition

- P0: user tidak bisa login, data hilang, permission/data leak.
- P1: tidak bisa create/update lead.
- P2: dashboard angka membingungkan, import sebagian gagal.
- P3: UI minor, copywriting, layout kurang enak.

## Response SLA

- [ ] P0 fix langsung.
- [ ] P1 fix hari sama.
- [ ] P2 batch fix malam.
- [ ] P3 masuk backlog.

---

# Phase 6 — H+1 sampai H+3 Stabilization Sprint

Owner: Engineering / Product

## Fokus

- User adoption.
- Data correctness.
- Bug dari real usage.

## Checklist

### Import Excel Hardening

- [ ] Tambah header aliases dari file Excel real user.
- [ ] Improve date parser jika format baru muncul.
- [ ] Improve stage mapping jika ada status baru.
- [ ] Improve duplicate handling jika false positive/negative tinggi.

### Lead Workflow

- [ ] Review field wajib yang menghambat input.
- [ ] Simplify form jika user bingung.
- [ ] Tambah default value untuk field yang sering kosong.
- [ ] Fix validation message yang tidak jelas.

### Dashboard Trust

- [ ] Tambah data freshness timestamp.
- [ ] Tambah tooltip basis KPI.
- [ ] Hide metrics yang belum reliable.
- [ ] Tambah note scope data: company, pipeline, period.

### Permission Fixes

- [ ] Fix role mismatch.
- [ ] Fix company scoping issue.
- [ ] Review holding company access.

### Performance

- [ ] Profile dashboard load time.
- [ ] Add DB indexes jika query lambat.
- [ ] Review expensive client-side aggregation.

---

# Phase 7 — Week 1: Management Dashboard v1

Owner: Product Analytics / Engineering

## Goal

Dashboard cukup untuk quick decision operasional mingguan.

## KPI Wajib

- [ ] Total Leads
- [ ] Won Revenue
- [ ] Pipeline Value
- [ ] Win Rate
- [ ] Avg Deal Size
- [ ] Leads Received This Month
- [ ] Leads Closing This Month

## Decision Widgets

- [ ] Top 10 Deals by Value
- [ ] Deals Stuck > X Days
- [ ] Leads Without Next Action
- [ ] Pipeline by Stage
- [ ] Sales Performance Basic
- [ ] Source Quality

## Trust Indicators

- [ ] Date basis label per KPI.
- [ ] Last updated timestamp.
- [ ] Data scope indicator:
  - [ ] company
  - [ ] pipeline
  - [ ] period
- [ ] Limited-data warning jika dashboard query capped.

---

# Phase 8 — Week 2: Governance & Security Hardening

Owner: Engineering

## Checklist

- [ ] Add Content-Security-Policy headers in `next.config.ts`.
- [ ] Add startup env validation:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Add Supabase integration tests for RLS company scoping.
- [ ] Add permission matrix tests.
- [ ] Add lead create/update integration tests.
- [ ] Audit all service role usage.
- [ ] Create role/account matrix document.
- [ ] Review git history for exposed credential if repo has remote exposure.

---

# Phase 9 — Week 3–4: Goal & Forecast Proper

Owner: Product / Engineering

## Goal

Re-enable advanced management reporting only after data model reliable.

## Checklist

- [ ] Build Goal Settings CMS.
- [ ] Define canonical period model:
  - [ ] monthly
  - [ ] quarterly
  - [ ] yearly
  - [ ] custom
- [ ] Choose one source of truth for targets.
- [ ] Migrate old target sources if needed.
- [ ] Implement forecast categories:
  - [ ] commit
  - [ ] best case
  - [ ] pipeline
- [ ] Build snapshot reporting:
  - [ ] weekly snapshot
  - [ ] monthly snapshot
- [ ] Re-enable Goal Forecast widget.
- [ ] Re-enable Goal Variance widget.
- [ ] Add tests for all goal/forecast calculations.

---

# Final Launch Checklist

## Must Pass Before Launch

- [ ] Login works.
- [ ] Role permissions sane.
- [ ] Company scoping sane.
- [ ] Lead create works.
- [ ] Lead edit works.
- [ ] Stage update works.
- [ ] Client company/contact relation works.
- [ ] Dashboard loads under acceptable time on pilot data.
- [ ] Import sample works.
- [ ] No hardcoded credentials.
- [ ] Goal forecast hidden or clearly beta.
- [ ] Known limitations documented.

## Nice To Have

- [ ] Dashboard mobile checked.
- [x] Dashboard PDF workaround added: dashboard export now opens print-ready HTML and uses browser Save as PDF.
- [ ] Dashboard print/save-as-PDF checked manually.
- [ ] Activity log checked.
- [ ] E2E test env configured.
- [ ] CSP added.

---

# Suggested User Communication

> Mulai besok, input dan update leads pindah ke LeadEngine. Excel tetap menjadi backup selama masa transisi, tetapi source kerja harian adalah LeadEngine. Dashboard dipakai untuk monitoring operasional awal. Beberapa fitur analitik lanjutan seperti forecast dan goal variance akan disempurnakan bertahap setelah data penggunaan real masuk.

---

# Execution Notes

Tambahkan catatan per item di bawah ini saat implementasi berjalan.

## Notes

- 2026-05-28: Plan dibuat untuk launch readiness dan phased execution.
