# Sitemap

LeadEngine punya dua peta alur. Sitemap untuk **alur autentikasi** (publik, tanpa app shell) dan sitemap untuk **aplikasi utama** (di balik login, dengan sidebar).

Routing memakai Next.js App Router. Setiap folder dengan `page.tsx` di `src/app/` adalah satu route. Segmen `[id]` adalah halaman detail dinamis. Visibilitas menu di sidebar dibatasi oleh permission (`can(module, action)`).

---

## 1. Auth Flow — Diagram Flow

Halaman publik yang bisa diakses tanpa sesi. Dirender standalone (tanpa sidebar) lewat pengecekan `x-pathname` di `src/proxy.ts` + root layout.

```mermaid
flowchart TD
    Start([User membuka aplikasi]) --> Guard{Punya sesi?}

    Guard -- "Tidak" --> Login["/login<br/>Sign in — email + password"]
    Guard -- "Ya" --> Home["/ Dashboard"]

    Login --> Forgot["/forgot-password<br/>Kirim email reset"]
    Forgot --> Reset["/reset-password<br/>Set password baru (recovery session)"]
    Reset --> Login
    Login -- "Login sukses" --> Home

    classDef pub fill:#eef2ff,stroke:#6366f1,color:#1e1b4b;
    class Login,Forgot,Reset pub;
```

| Route | Fungsi |
|---|---|
| `/login` | Form sign in (email + password). Redirect ke `/` jika sudah login. |
| `/forgot-password` | Minta link reset password via email. |
| `/reset-password` | Set password baru. Sesi "recovery" boleh tetap di sini sampai selesai. |

---

## 2. Aplikasi Utama — Diagram Flow

Semua halaman di balik login. Dibungkus `MainLayout` (sidebar + company switcher). Urutan menu mengikuti `sidebar.tsx`.

```mermaid
flowchart TD
    Home["/ — Dashboard<br/>Analytics: KPI, goals, custom widgets"]

    Home --> Menu{{"MENU (sidebar)"}}
    Home --> Admin{{"ADMINISTRATION (sidebar)"}}
    Home --> Profile["/settings/profile<br/>Profil user (dari kartu user)"]

    %% ---------- MENU ----------
    Menu --> Pipeline["/leads — Pipeline<br/>Kanban board lead per stage"]
    Menu --> Companies["/companies<br/>Daftar client company"]
    Menu --> Contacts["/contacts<br/>Daftar kontak"]
    Menu --> History["/history<br/>Activity log lintas entitas"]

    Pipeline --> LeadDetail["/leads/[leadId]<br/>Detail lead + aktivitas"]
    LeadDetail --> LeadPrint["/leads/[leadId]/print<br/>Dokumen cetak (standalone)"]

    Companies --> CompanyDetail["/companies/[companyId]<br/>Detail client company"]
    Contacts --> ContactDetail["/contacts/[contactId]<br/>Detail kontak"]

    %% ---------- ADMINISTRATION ----------
    Admin --> Settings["/settings — Settings hub"]
    Admin --> Changelog["/changelog — Changelog<br/>Catatan rilis"]

    Settings --> Config{{"Configuration"}}
    Settings --> Workspace{{"Workspace"}}
    Settings --> Access{{"Administration"}}

    Config --> Master["/settings/master-options<br/>Lead fields, dropdown, form layout, segment"]
    Config --> PipelineCfg["/settings/pipeline<br/>Stage workflow per pipeline"]
    Config --> GoalsCfg["/settings/goals<br/>Periode, attribution, forecasting"]

    PipelineCfg --> PipelineId["/settings/pipeline/[pipelineId]<br/>Edit stage 1 pipeline"]
    GoalsCfg --> GoalSlug["/settings/goals/[slug]<br/>Editor goal periode"]

    Workspace --> CompaniesCfg["/settings/companies<br/>Holding & subsidiary"]
    Workspace --> Users["/settings/users<br/>Tim, role, kuota, provisioning"]

    CompaniesCfg --> CompanyNew["/settings/companies/new<br/>Buat company baru"]
    CompaniesCfg --> CompanySlug["/settings/companies/[slug]"]
    CompanySlug --> CompanyMembers["/settings/companies/[slug]/members<br/>Kelola anggota"]

    Access --> Perms["/settings/permissions<br/>Matriks role & permission + currency"]

    classDef hub fill:#f1f5f9,stroke:#64748b,color:#0f172a;
    classDef page fill:#ffffff,stroke:#cbd5e1,color:#0f172a;
    classDef detail fill:#fff7ed,stroke:#f59e0b,color:#7c2d12;
    class Home,Settings hub;
    class Pipeline,Companies,Contacts,History,Changelog,Master,PipelineCfg,GoalsCfg,CompaniesCfg,Users,Perms,Profile page;
    class LeadDetail,LeadPrint,CompanyDetail,ContactDetail,PipelineId,GoalSlug,CompanyNew,CompanySlug,CompanyMembers detail;
```

---

## Referensi route lengkap

### Top-level (sidebar)

| Menu | Route | Permission | Keterangan |
|---|---|---|---|
| Dashboard | `/` | `dashboard.read` | Analytics dashboard: KPI cards, goals, custom widgets. |
| Pipeline | `/leads` | `leads.read` | Kanban board lead per stage. |
| Companies | `/companies` | `companies.read` | Daftar client company (CRM). |
| Contacts | `/contacts` | `contacts.read` | Daftar kontak. |
| History | `/history` | selalu tampil | Activity log lintas entitas. |
| Settings | `/settings` | `settings.read` | Hub konfigurasi workspace. |
| Changelog | `/changelog` | `settings.read` | Catatan rilis / changelog. |

### Halaman detail (dinamis)

| Route | Keterangan |
|---|---|
| `/leads/[leadId]` | Detail lead + timeline aktivitas. |
| `/leads/[leadId]/print` | Versi cetak lead (standalone, tanpa app shell). |
| `/companies/[companyId]` | Detail client company. |
| `/contacts/[contactId]` | Detail kontak. |

### Settings sub-pages

| Section | Route | Keterangan |
|---|---|---|
| Configuration | `/settings/master-options` | Lead fields, dropdown options, custom form layout, segment rules. |
| Configuration | `/settings/segments` | Pengelolaan segment (terkait master-options). |
| Configuration | `/settings/pipeline` → `/settings/pipeline/[pipelineId]` | Stage workflow per pipeline. |
| Configuration | `/settings/goals` → `/settings/goals/[slug]` | Periode, attribution, forecasting, reporting. |
| Workspace | `/settings/companies` → `/new`, `/[slug]`, `/[slug]/members` | Holding, subsidiary, member assignment. |
| Workspace | `/settings/users` | Hierarki tim, role, kuota sales, provisioning. |
| Administration | `/settings/permissions` | Matriks akses semua role + currency display. |
| — | `/settings/profile` | Profil user (diakses dari kartu user di sidebar). |
| — | `/settings/registry` | Registry field (dimension registry). |

### Lain-lain

| Route | Keterangan |
|---|---|
| `/dashboard` | Route dashboard alternatif. |
| `/goals` | Halaman goals (di luar settings). |

> Catatan: halaman auth (`/login`, `/forgot-password`, `/reset-password`) dan halaman print (`/leads/[leadId]/print`) dirender **standalone** tanpa sidebar/app shell. Logikanya ada di `src/app/layout.tsx` berdasarkan header `x-pathname` yang di-set di `src/proxy.ts`.
