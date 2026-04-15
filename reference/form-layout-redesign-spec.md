> Historical design brief: this file captures redesign intent, not the canonical implemented system state.
> Use [docs/leadengine-system-overview.md](D:\Website\Group Lead 2026\docs\leadengine-system-overview.md) for current system truth.

# Form Layout Settings — UI/UX Redesign Specification

> **Prompt untuk IDE agent — redesign halaman Form Layout agar lebih compact, profesional, dan space-efficient. JANGAN ubah font-family — gunakan font yang sudah ada di project.**

---

## 1. Scope & Objective

Halaman ini digunakan Admin untuk mengatur field layout pada form entry Lead, Companies, dan Contacts. Fitur yang sudah berjalan:
- Drag & drop fields antar section
- Toggle required (REQ) per field
- Conditional visibility rules (⚡)
- Unused Fields container
- Multi-form tabs (Leads, Companies, Contacts)

**Yang perlu diperbaiki (UIUX only, bukan logic):**
- Whitespace berlebihan di section header dan antar elemen
- Warna tab active tidak kohesif dengan design system
- Info banner terlalu besar dan tidak dismissible
- Dashed border pada section card kurang profesional
- Aksi per field (REQ toggle, ⚡) terlalu kecil dan berdempetan
- Double indicator untuk required (asterisk + toggle)
- Unused Fields boros space saat kosong

**PENTING:** Jangan ubah font-family. Gunakan font yang sudah ada. Hanya ubah ukuran, weight, dan warna.

---

## 2. Visual Tokens (Tanpa Font Family)

```css
/* JANGAN tambahkan font-family — pakai yang sudah ada di project */

/* ── Text Sizes ── */
--page-title:      20px, weight 800
--section-title:   13px, weight 700
--field-label:     12.5px, weight 500
--meta-text:       10.5px, weight 400
--badge-text:      10px, weight 700
--caption:         11px, weight 400

/* ── Colors ── */
--bg-page:         #f2f3f6;
--bg-card:         #ffffff;
--bg-subtle:       #fafbfc;
--text-primary:    #0f1729;
--text-secondary:  #8892a4;
--text-muted:      #94a3b8;
--primary:         #6366f1;       /* active states, toggles, indicators */
--primary-light:   #eef2ff;
--primary-dark:    #4f46e5;
--positive:        #10b981;
--negative:        #ef4444;
--warning:         #f59e0b;
--border:          #e5e8ed;
--border-light:    #f1f3f5;

/* ── Spacing ── */
--card-padding:    14px;
--field-row-h:     40px;          /* tinggi per field row — compact */
--field-gap:       2px;           /* gap antar field rows */
--section-gap:     12px;          /* gap antar section cards */
--header-to-field: 8px;           /* gap dari section title ke field pertama */
```

---

## 3. Page Header

### Sekarang:
```
≡  Master Options & Custom Fields          (besar, banyak margin)
   Manage dropdown values and dynamic form fields.

   Dropdown Options   Custom Fields   [Form Layout]   System Rules
```

### Seharusnya:

```
┌─────────────────────────────────────────────────────────────────┐
│  ≡ Master Options & Custom Fields                               │
│  Manage dropdown values and dynamic form fields.                │
│                                                                  │
│  Dropdown Options   Custom Fields   [Form Layout]   System Rules│
└─────────────────────────────────────────────────────────────────┘
```

**Perubahan:**
- Kurangi margin-bottom page title dari ~24px → **12px**
- Kurangi margin-bottom subtitle dari ~16px → **8px**
- Kurangi gap antara tab bar dan content di bawahnya dari ~24px → **16px**
- Total space saved: ± 30-40px vertikal

---

## 4. Form Tab Pills (Leads / Companies / Contacts)

### Sekarang:
- Active tab: background merah/coral
- Ini tidak match dengan primary color platform (indigo)

### Seharusnya:

```
Active tab:
- Background: --primary (#6366f1)
- Text: white, weight 600
- Border-radius: 20px (pill shape — bisa dipertahankan)
- Padding: 6px 16px

Inactive tab:
- Background: transparent
- Border: 1px solid --border
- Text: --text-secondary, weight 500
- Hover: bg --primary-light, text --primary

Transition: background 150ms ease, color 150ms ease
```

**Alasan:** Merah biasanya reserved untuk error/destructive. Primary color (indigo) lebih konsisten dan tidak membingungkan.

---

## 5. Info Banner — Compact & Dismissible

### Sekarang:
- Banner biru besar, 2 baris teks, selalu tampil
- Mengambil ~60px tinggi

### Seharusnya:

```
┌─ ℹ ─────────────────────────────────────────────────────── ✕ ─┐
│  Drag fields to reorder. Move to "Unused Fields" to hide.     │
│  Toggle REQ for mandatory. Click ⚡ for conditional rules.     │
└───────────────────────────────────────────────────────────────┘
```

**Specs:**
```
Height: auto (1-2 baris teks, compact)
Padding: 8px 14px (BUKAN 16px 20px)
Background: #eef2ff (primary-light, BUKAN biru tua)
Border: 1px solid #c7d2fe
Border-radius: 8px
Text: 11.5px, weight 400, color #4338ca
Icon (ℹ): 14px, margin-right 8px
Close (✕): 14px, --text-muted, top-right
  - On click: banner hilang
  - Simpan preference di localStorage agar tidak muncul lagi
  - Atau: tampilkan ulang via "?" icon di page header

Max 2 baris — compress copy agar singkat
Margin-bottom: 12px (BUKAN 20px)
```

**Alternatif jika sudah pernah di-dismiss:**
```
Ganti banner dengan small icon button "?" di sebelah page title
- Tooltip on hover menampilkan instruksi yang sama
- Lebih minimal, tidak mengambil space permanen
```

---

## 6. Section Cards (Project Tab, Event Tab, Unused Fields)

### 6.1 Card Container

### Sekarang:
- Border: dashed, tebal
- Padding dalam card besar
- Gap dari section title ke field pertama: ~40-50px

### Seharusnya:

```
Card container:
- Border: 1px SOLID --border (BUKAN dashed)
  - Exception: "Unused Fields" BOLEH tetap dashed karena sifatnya drop target
- Border-radius: 10px
- Background: --bg-card
- Box-shadow: 0 1px 2px rgba(0,0,0,.03)
- Overflow: hidden
- Padding: 0 (padding diatur per section, bukan card)
```

### 6.2 Section Header (di dalam card)

### Sekarang:
```
   Project Tab  10            ← terlalu banyak padding, count tidak distinct
```

### Seharusnya:

```
┌─────────────────────────────────────────────────────┐
│  Project Tab                          10 fields   ⋮ │  ← compact header
├─────────────────────────────────────────────────────┤
│  (fields mulai langsung di sini)                     │
```

**Specs:**
```
Section header:
- Display: flex, space-between, align-items center
- Padding: 10px 14px (BUKAN 20px+ yang sekarang)
- Border-bottom: 1px solid --border-light
- Background: --bg-subtle (#fafbfc) — sedikit beda dari card body

Title (kiri):
- Text: 13px, weight 700, --text-primary
- Contoh: "Project Tab"

Count (kanan):
- Text: "10 fields" — 10.5px, weight 500, --text-muted
- BUKAN angka saja — tambah kata "fields" untuk clarity
- Atau: pill badge style
  - Background: --primary-light
  - Color: --primary
  - Padding: 1px 7px
  - Border-radius: 10px
  - Font: 10px, weight 700

Section menu (⋮): optional
- Collapse/Expand section
- Rename section (jika applicable)
```

**Gap dari header ke field pertama:**
```
SEKARANG:  ~40-50px  ← TERLALU BESAR
SEHARUSNYA: 0px      ← fields langsung mulai setelah header border

Section header padding-bottom: 10px
Field list padding-top: 0px
Artinya visual gap = 10px (dari padding-bottom header) — compact
```

### 6.3 Section Card Layout Grid

```
SEKARANG:
[Project Tab (50%)] [Event Tab (50%)] [Unused Fields (partial)]

SEHARUSNYA:
grid-template-columns: 1fr 1fr auto
- Column 1 & 2: equal width, untuk form sections
- Column 3: Unused Fields, fixed width atau collapsible
- Gap: 12px

Unused Fields ketika kosong:
- Width: 200px (collapsed)
- Hanya tampilkan header + empty state icon
- Expandable on hover/click

Unused Fields ketika ada items:
- Width: 280px
- Scrollable list
```

---

## 7. Field Rows — Compact & Clear

### 7.1 Field Row Layout

### Sekarang:
```
⠿  PIC Sales  *     REQ 🔵  ⚡      ← terlalu banyak indikator, spacing inconsistent
```

### Seharusnya:

```
┌─────────────────────────────────────────────────────────────┐
│  ⠿  ●  PIC Sales                    🔵 REQ    ⚡ ×2    ⋮  │
└─────────────────────────────────────────────────────────────┘

Di mana:
- ⠿  = drag handle
- ●  = required indicator (red dot, HANYA muncul saat REQ ON)
- PIC Sales = field name
- 🔵 REQ = toggle required
- ⚡ ×2 = conditional rules count (jika ada)
- ⋮  = more menu (hide, delete, edit)
```

### 7.2 Specs

```
Field row:
- Height: 40px (fixed, compact — BUKAN auto/variable)
- Padding: 0 14px
- Display: flex, align-items center
- Border-bottom: 1px solid #f3f4f6 (sangat subtle)
- Background: transparent
- Hover: background #fafbfc
- Transition: background 100ms ease

Drag handle (⠿):
- Width: 16px
- Color: #d1d5db
- Opacity: 0 → 1 on row hover (hidden by default, muncul saat hover)
- Cursor: grab
- Margin-right: 8px

Required dot (●):
- Diameter: 6px
- Color: --negative (#ef4444) saat required ON
- Color: transparent saat required OFF
- Margin-right: 8px
- Ini MENGGANTIKAN asterisk (*) — satu indikator saja
- Transisi: scale 0→1 saat toggle ON, scale 1→0 saat OFF

Field name:
- Size: 12.5px, weight 500
- Color: --text-primary
- Flex: 1 (fill remaining space)
- Ellipsis jika kepanjangan (text-overflow: ellipsis)
- JANGAN tampilkan asterisk (*) di samping nama
  — cukup required dot di kiri saja

REQ toggle:
- Width: 32px, height: 18px (compact toggle)
- Active: --primary background
- Inactive: #d1d5db background
- Label "REQ": 9px, weight 600, uppercase, --text-muted
  - Posisi: di KIRI toggle (bukan terpisah jauh)
  - Gap dari label ke toggle: 4px
- Margin-right: 12px

Conditional rules (⚡):
- Icon: ⚡ (lightning bolt)
- Color: --warning (#f59e0b) jika ada rules aktif, --text-muted jika tidak
- Count: "×2" di samping icon, 9px, weight 600
  - Hanya muncul jika count > 0
- Hover: tooltip "2 visibility rules applied — click to edit"
- Click: buka conditional rule editor (existing behavior)
- Margin-right: 8px

More menu (⋮):
- Muncul on row hover only
- Color: --text-muted
- Click: dropdown menu [Hide Field, Edit Field, Delete Field]
```

### 7.3 Required Toggle — Single Source of Truth

```
SEKARANG:
- Asterisk (*) merah di nama field + toggle REQ = 2 indikator
- Membingungkan: mana yang control, mana yang indicator?

SEHARUSNYA:
- Toggle REQ = control (satu-satunya cara set required)
- Red dot (●) = visual indicator, otomatis muncul/hilang berdasarkan toggle
- HAPUS asterisk (*) dari nama field
- Ini mengurangi visual clutter dan membuat satu source of truth
```

### 7.4 Drag & Drop Behavior

```
Drag start:
- Row lifts: box-shadow 0 4px 16px rgba(0,0,0,.1)
- Opacity: 0.92
- Scale: 1.01 (very subtle)
- Cursor: grabbing

Drag over:
- Placeholder: 40px height, border 2px dashed --primary, radius 6px
- Background: --primary-light

Drop:
- Smooth settle animation, 200ms ease
- Placeholder collapses, row inserts

Cross-section drag:
- Dari section A ke section B → field berpindah section
- Ke Unused Fields → field disembunyikan dari form
- Dari Unused Fields → field ditambahkan kembali ke form
```

---

## 8. Unused Fields Section

### 8.1 Saat Kosong (0 fields)

```
┌─ Unused Fields ────────────────┐
│                                 │
│     ⊘ No unused fields         │
│     Drag fields here to hide   │
│                                 │
└─────────────────────────────────┘

Specs:
- Border: 1px dashed #c7d2fe (lembut, bukan gelap)
- Background: transparent
- Min-height: 120px (BUKAN full height match sibling)
- Text centered: icon + title + subtitle
- Icon (⊘): 20px, --text-muted
- Title: 11.5px, weight 500, --text-secondary
- Subtitle: 10.5px, --text-muted
```

### 8.2 Saat Ada Fields

```
┌─ Unused Fields ─── 3 ─────────┐
│                                 │
│  ⠿  Source URL                 │
│  ⠿  Internal Notes            │
│  ⠿  Legacy ID                 │
│                                 │
└─────────────────────────────────┘

Specs:
- Border: 1px dashed #c7d2fe
- Field rows: same height (40px), simpler (no REQ toggle, no ⚡)
  - Hanya: drag handle + field name
  - Hover: show "↩ Restore" text button (move back to a section)
- Max-height: match tallest sibling card, internal scroll
- Scrollbar: 4px, subtle
```

### 8.3 Drop Target Visual Feedback

```
Saat field sedang di-drag OVER Unused Fields area:
- Border: 2px dashed --primary (lebih tebal, warna primary)
- Background: --primary-light (sangat subtle fill)
- Scale: 1.01
- Transition: 150ms ease

Saat drag leaves:
- Kembali ke default dashed border
```

---

## 9. Conditional Visibility Indicator (⚡) — Enhanced

### Sekarang:
- Icon kecil ⚡ yang sulit dilihat
- "×2" sangat kecil

### Seharusnya:

```
State 1 — No rules:
- Icon ⚡ warna --text-muted (abu)
- Tidak ada count
- Hover tooltip: "Click to add visibility rules"

State 2 — Has rules:
- Icon ⚡ warna --warning (#f59e0b)
- Count badge: "×2" di samping
  - Font: 9px, weight 700
  - Color: --warning
- Hover tooltip: "2 visibility rules — click to manage"
- Subtle pulse animation on icon (opsional, untuk menarik perhatian)

Click behavior:
- Buka conditional rule editor (existing behavior, tidak perlu diubah)
```

---

## 10. Scrollbar Styling

```
SEKARANG:
- Scrollbar per section terlalu tebal dan gelap

SEHARUSNYA:
- Width: 4px
- Thumb: #d1d5db, border-radius 2px
- Track: transparent
- Visible: on hover only (auto-hide)
- Smooth scroll behavior
```

---

## 11. Spacing Summary — Before vs After

```
Element                          Before    After     Saved
─────────────────────────────────────────────────────────
Page title margin-bottom         ~24px     12px      12px
Subtitle margin-bottom           ~16px     8px       8px
Tab bar to content               ~24px     16px      8px
Info banner height               ~60px     36px      24px  (or 0 if dismissed)
Info banner margin-bottom        ~20px     12px      8px
Section title padding            ~20px     10px      10px
Section title to first field     ~40px     10px      30px ← BIGGEST WIN
Field row height                 ~48px     40px      8px per row
Field row gap                    ~4px      2px       2px per gap
Section card gap                 ~16px     12px      4px
─────────────────────────────────────────────────────────
Total vertical space saved (above fold):  ~100-120px

Dengan 10 fields, itu artinya admin bisa melihat 2-3 field LEBIH BANYAK
tanpa scroll. Untuk form dengan 20+ fields, ini significant.
```

---

## 12. Responsive Behavior

```
Desktop (≥1280px):
- Grid: [Section 1] [Section 2] [Unused Fields]
- 3 columns as described

Tablet (768-1279px):
- Grid: [Section 1] [Section 2]
- Unused Fields: collapsed to bottom, full width, horizontal layout
- Atau: floating panel yang bisa di-toggle

Mobile (≤767px):
- All sections stacked vertically
- Unused Fields: collapsible accordion at bottom
- Field rows: same compact height
- Drag & drop: long-press to initiate (mobile pattern)
- REQ toggle dan ⚡ tetap visible (jangan hide on mobile)
```

---

## 13. Checklist

### Spacing & Layout:
- [ ] Page header margins reduced (12px, 8px, 16px)
- [ ] Section header padding: 10px 14px
- [ ] Gap section title → first field: 10px max (BUKAN 40px)
- [ ] Field row height: 40px fixed
- [ ] Field row gap: 2px
- [ ] Section card gap: 12px
- [ ] Info banner compact (36px height) atau dismissed

### Visual:
- [ ] Tab pills: active = --primary (#6366f1), BUKAN merah
- [ ] Section cards: solid border (BUKAN dashed, kecuali Unused Fields)
- [ ] Section header: subtle background (#fafbfc) + border-bottom
- [ ] Field count: "10 fields" badge di header kanan
- [ ] Drag handle: hidden default, visible on row hover
- [ ] Scrollbar: 4px, auto-hide

### Required Indicator:
- [ ] HAPUS asterisk (*) dari field names
- [ ] REQ toggle = satu-satunya control
- [ ] Red dot (●) 6px = otomatis visual indicator saat REQ ON
- [ ] Single source of truth — tidak ada double indicator

### Conditional Rules (⚡):
- [ ] Abu saat no rules, amber saat has rules
- [ ] Count badge "×N" di samping icon
- [ ] Tooltip on hover dengan deskripsi
- [ ] Click behavior: buka editor (existing)

### Unused Fields:
- [ ] Compact saat kosong (120px, centered empty state)
- [ ] Dashed border lembut (#c7d2fe)
- [ ] Drop target visual feedback (thicker border + fill on drag-over)
- [ ] Field rows simplified (no toggle, no ⚡, hanya name + drag)

### Info Banner:
- [ ] Compact 1-2 baris
- [ ] Dismissible (✕) dengan localStorage preference
- [ ] Atau: ganti jadi "?" icon tooltip di page header

### JANGAN ubah:
- [ ] ❌ Font-family — pakai yang sudah ada
- [ ] ❌ Drag & drop logic — sudah bekerja
- [ ] ❌ Conditional visibility logic — sudah bekerja
- [ ] ❌ REQ toggle logic — sudah bekerja (hanya ubah visual)
- [ ] ❌ Cross-section drag logic — sudah bekerja
