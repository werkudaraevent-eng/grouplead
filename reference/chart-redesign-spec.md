# Performance Dashboard — Chart & Analytics Section Redesign

> **Prompt untuk IDE agent — redesign semua chart/grafik di dashboard agar modern, data-rich, actionable, dan space-efficient.**

---

## 1. Design Philosophy

Dashboard ini digunakan oleh **management / group lead** untuk membuat **quick decisions** tentang:
- Siapa yang perlu di-push? (sales performance)
- Dari mana lead terbaik datang? (lead source ROI)
- Mana yang harus diprioritaskan? (classification & pipeline)
- Siapa klien yang paling valuable? (revenue generators)

**Setiap chart HARUS menjawab pertanyaan bisnis, BUKAN hanya menampilkan data.**

### Prinsip:
1. **Data density tinggi** — minimize wasted space, maximize informasi per pixel
2. **Comparative context** — setiap angka harus punya pembanding (target, last period, benchmark)
3. **Visual hierarchy** — yang paling penting paling menonjol
4. **Actionable cues** — warna, icon, atau label yang menunjukkan "perlu tindakan"
5. **Consistent compact styling** — semua chart pakai spacing system yang sama

---

## 2. Design Tokens (Matching KPI Cards)

```css
/* Card */
border-radius: 10px;
border: 1px solid #e5e8ed;
background: #ffffff;
box-shadow: 0 1px 2px rgba(0,0,0,.03);

/* Card padding — compact, proporsional */
padding: 16px;

/* Card header */
title: 12.5px, weight 700, color #0f1729
subtitle: 10.5px, weight 400, color #8892a4
margin-bottom antara header dan chart: 12px

/* Gap antar chart cards */
gap: 10px

/* Chart colors — cohesive palette */
--chart-1: #6366f1;   /* Indigo — primary */
--chart-2: #8b5cf6;   /* Violet */
--chart-3: #0ea5e9;   /* Sky */
--chart-4: #10b981;   /* Emerald */
--chart-5: #f59e0b;   /* Amber */
--chart-6: #ef4444;   /* Red — negative/lost */
--chart-7: #ec4899;   /* Pink */
--chart-muted: #e2e5ea;  /* Unfilled/remaining */

/* Text in charts */
axis-label: 9px, color #94a3b8
data-label: 10px, weight 600, color #0f1729
annotation: 10px, weight 500, italic, color #8892a4
```

---

## 3. Grid Layout

Dashboard content area (di bawah KPI cards) harus menggunakan grid yang space-efficient:

```
Row 1: [Sales Performance vs Target (3fr)] [Top Revenue Generators (2fr)]
Row 2: [Lead Source (1fr)] [Classification (1fr)] [Stream Alignment (1fr)]

Gap: 10px (sama dengan KPI cards)
```

JANGAN biarkan satu chart mengambil space yang tidak proporsional dengan jumlah data yang ditampilkan.

---

## 4. Chart Specifications

---

### 4.1 Sales Performance vs Target

**Tipe:** Horizontal grouped bar chart (bar = actual, ghost bar = target)

**Tujuan bisnis:** Management melihat siapa yang perform dan siapa yang butuh bantuan.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  Sales Performance vs Target                    This Month ▾ │
│  Revenue achievement per sales rep                           │
│                                                              │
│  ┌─ Name ────── ┬─── Bar ──────────────── ┬─ Value ───────┐ │
│  │ Ahmad R.     │ ████████████░░░░░░░░░░░ │ Rp 1.2B / 2B  │ │
│  │ Budi S.      │ ██████████████████░░░░░ │ Rp 1.8B / 2B  │ │
│  │ Citra D.     │ ████░░░░░░░░░░░░░░░░░░ │ Rp 400M / 2B  │ │
│  │ Unassigned   │ ██████████████████████░ │ Rp 2.9B / —   │ │
│  └──────────────┴─────────────────────────┴───────────────┘ │
│                                                              │
│  ● Above Target  ● On Track  ● Below Target  ● Unassigned   │
└──────────────────────────────────────────────────────────────┘
```

**Spesifikasi visual:**
- Horizontal bars, sorted descending by actual revenue
- Setiap bar punya DUA layer:
  - **Solid bar** = actual revenue (warna berdasarkan performance)
  - **Ghost bar (10% opacity)** = target, sebagai background reference
- Warna berdasarkan achievement percentage:
  - ≥100% target: `#10b981` (hijau — above target)
  - 70-99% target: `#6366f1` (indigo — on track)
  - <70% target: `#ef4444` (merah — needs attention)
  - No target (unassigned): `#94a3b8` (abu — flag sebagai data issue)
- Nama sales rep di kiri, rata kiri, 11px weight 500
- Value di kanan: "Rp 1.2B / 2B" format (actual / target), 10px
- Achievement percentage badge di ujung bar: "60%" dalam pill kecil
- Bar height: 28px, gap antar bar: 8px, border-radius bar: 4px

**Data quality handling:**
- Kalau ada "Unassigned" revenue, tampilkan di paling bawah dengan style berbeda (dashed border, muted color)
- Tambahkan small warning icon ⚠ dan tooltip: "Revenue belum di-assign ke sales rep"

**Empty state:** Kalau hanya ada 1 sales rep atau semua Unassigned:
- Tetap tampilkan chart, tapi tambahkan callout banner di bawah:
  "💡 Assign leads to sales reps for better performance tracking"

---

### 4.2 Top 10 Revenue Generators

**Tipe:** Horizontal bar chart with rank numbers

**Tujuan bisnis:** Identifikasi high-value clients untuk retention dan upsell.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  Top Revenue Generators                     Won Revenue ▾    │
│  Client companies by contribution                            │
│                                                              │
│   1  PT Telkom        ████████████████████████   Rp 2.9B     │
│   2  PT Astra         █████████████████          Rp 1.8B     │
│   3  Bank Mandiri     ████████████               Rp 1.2B     │
│   4  Pertamina        ████████                   Rp 800M     │
│   5  Unilever         █████                      Rp 500M     │
│                                                              │
│  Total Won Revenue: Rp 7.2B from 5 companies                │
└──────────────────────────────────────────────────────────────┘
```

**Spesifikasi visual:**
- Rank number di kiri: 10px, weight 700, color sesuai rank (#6366f1 top 3, #8892a4 sisanya)
- Company name: 11px, weight 500, truncate kalau kepanjangan
- Bar: gradient `linear-gradient(90deg, #6366f1, #818cf8)`, height 22px, radius 4px
- Value di kanan bar: 10px, weight 700
- Bar width proportional ke max value
- Summary footer: "Total Won Revenue: Rp X from N companies" — 10.5px, muted

**Data quality handling:**
- "Unknown Company" → tampilkan dengan style berbeda (italic, muted, dashed border)
- Tambah tooltip: "Update company name in lead details for better tracking"

**Kalau data < 3 entries:**
- Chart tetap ditampilkan, space sisanya JANGAN dibiarkan kosong
- Tambahkan insight text: "Diversify client base — top 1 client contributes 100% of revenue"

---

### 4.3 Lead Source

**Tipe:** BUKAN donut chart. Gunakan **horizontal stacked bar + breakdown list**.

**Tujuan bisnis:** Identifikasi channel mana yang paling efektif untuk alokasi budget.

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Lead Source                                         │
│  Origin channel distribution                         │
│                                                      │
│  ████████████████░░░░░░░░░░████████░░░  Total: 24   │
│  ← stacked horizontal bar, 1 baris                   │
│                                                      │
│  Referral          ████████████  12  (50%)  ▲ +3     │
│  Event Partnership ██████        6  (25%)  — 0      │
│  Direct Request    ████          4  (17%)  ▼ -2     │
│  Cold Call         █             1  ( 4%)  ▼ -1     │
│  Repeat Client     █             1  ( 4%)  ▲ +1     │
│                                                      │
│  💡 Referral is your top source — invest in program  │
└──────────────────────────────────────────────────────┘
```

**Spesifikasi visual:**
- **Top section:** single horizontal stacked bar (height 10px, radius 5px) menunjukkan proporsi semua channel
- **Breakdown list:** tiap channel satu row:
  - Nama channel: 11px, weight 500
  - Mini horizontal bar: height 6px, proportional, warna unik per channel
  - Count: 10.5px, weight 700
  - Percentage: 10px, muted
  - Change indicator: ▲/▼/— dengan warna hijau/merah/abu (vs last period)
- Sorted descending by count
- Warna per channel:
  - Referral: `#6366f1`
  - Event Partnership: `#8b5cf6`
  - Direct Request: `#0ea5e9`
  - Cold Call: `#f59e0b`
  - Repeat Client: `#10b981`

**Insight callout (bawah chart):**
- Auto-generate berdasarkan data: channel dengan share terbesar
- Style: 10px, italic, left-border 2px `#6366f1`, padding-left 8px
- Contoh: "💡 Referral is your top source at 50% — consider expanding the referral program"

**JANGAN gunakan:**
- ❌ Donut/pie chart (sulit membandingkan proporsi)
- ❌ Legend terpisah di bawah (buang space, mata bolak-balik)

---

### 4.4 Classification

**Tipe:** BUKAN donut chart. Gunakan **segmented bar + metric cards**.

**Tujuan bisnis:** Seberapa "panas" pipeline kita? Berapa yang siap close?

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Lead Classification                                 │
│  Pipeline temperature breakdown                      │
│                                                      │
│  ██████████████████░░░░░░░░░░░░░████  Total: 24     │
│  ← segmented bar: Hot | Warm | Cold                  │
│                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │  🔴 Hot    │  │  🟡 Warm   │  │  🔵 Cold   │     │
│  │    8       │  │    10      │  │    6        │     │
│  │   33%      │  │   42%      │  │   25%       │     │
│  │  ▲ +2 MoM  │  │  — 0 MoM  │  │  ▼ -2 MoM  │     │
│  └────────────┘  └────────────┘  └────────────┘     │
│                                                      │
│  💡 Hot leads increased 33% — prioritize follow-up   │
└──────────────────────────────────────────────────────┘
```

**Spesifikasi visual:**
- **Segmented bar** di atas: 3 segment (Hot/Warm/Cold), height 10px, radius 5px
  - Hot: `#ef4444`, Warm: `#f59e0b`, Cold: `#6366f1`
- **Metric cards** di bawah: 3 mini cards side by side
  - Background: accent color 5% opacity
  - Label: "Hot" / "Warm" / "Cold", 10px weight 600
  - Count: 18px, weight 800
  - Percentage: 10px, muted
  - MoM change: badge style (▲ +2 hijau, — 0 abu, ▼ -2 merah)
  - Border-radius: 8px, padding: 10px
- **Color logic yang BENAR:**
  - Hot = merah/oranye (panas, siap close)
  - Warm = kuning/amber (dalam proses)
  - Cold = biru (belum engage, perlu nurturing)
  - JANGAN pakai merah untuk Cold — itu confusing

**JANGAN gunakan:**
- ❌ Donut/pie chart
- ❌ Warna yang sama untuk Hot dan Cold (seperti di versi sebelumnya)

---

### 4.5 Stream Alignment

**Tipe:** Horizontal bar chart with category labels

**Tujuan bisnis:** Distribusi leads di tiap business stream untuk resource allocation.

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Stream Alignment                          All ▾     │
│  Business alignment distribution                     │
│                                                      │
│  Digital Transform  ████████████████   8  (33%)      │
│  Cloud Services     ████████████       6  (25%)      │
│  Consulting         ████████           4  (17%)      │
│  Managed Services   ██████             3  (13%)      │
│  Unspecified        ████               2  ( 8%)      │
│  Other              █                  1  ( 4%)      │
│                                                      │
│  💡 Digital Transform leads — align sales capacity   │
└──────────────────────────────────────────────────────┘
```

**Spesifikasi visual:**
- Sama seperti Lead Source breakdown list
- "Unspecified" ditampilkan dengan style muted + dashed bar (data quality flag)
- Bar warna: gradient dari chart palette, assigned secara berurutan
- Dropdown filter: tanpa label "Main Stream" yang tidak jelas — gunakan "All" / "Main Stream" / "Sub Stream" dengan tooltip penjelasan

---

## 5. Insight Engine (Auto-generated Callouts)

Setiap chart HARUS punya 1 insight callout di bagian bawah. Ini yang membedakan dashboard biasa dengan dashboard yang actionable.

**Rules:**
- Hanya 1 insight per chart — JANGAN lebih
- Bahasa singkat, actionable: "Referral is your top source — expand the program"
- Format: left-border 2px accent color, padding-left 8px, italic 10px
- Icon: 💡 untuk insight positif, ⚠ untuk warning, 📌 untuk action item

**Logic:**
```
Sales Performance:
- Kalau ada rep < 50% target → "⚠ {name} at {x}% — schedule performance review"
- Kalau semua > 80% → "💡 Team on track — consider raising targets"
- Kalau ada Unassigned → "⚠ Rp {x} unassigned — distribute to sales reps"

Top Revenue:
- Kalau top 1 client > 50% total → "⚠ High client concentration — {name} is {x}% of revenue"
- Kalau > 5 clients → "💡 Healthy diversification across {n} clients"

Lead Source:
- Tampilkan top channel: "💡 {channel} is your top source at {x}%"
- Kalau satu channel > 60% → append "— consider diversifying"

Classification:
- Kalau Hot > 30% → "💡 Hot leads at {x}% — prioritize immediate follow-up"
- Kalau Cold > 50% → "⚠ {x}% leads are cold — review nurturing strategy"

Stream:
- Tampilkan top stream: "💡 {stream} leads the pipeline — align sales capacity"
- Kalau Unspecified > 20% → "⚠ {x}% leads unspecified — improve data capture"
```

---

## 6. Empty State & Sparse Data Handling

Dashboard dengan data sedikit (seperti saat ini) HARUS tetap terlihat profesional.

**Rules:**
1. JANGAN biarkan chart kosong dengan whitespace besar
2. Kalau data < 3 items, chart tetap tampil tapi resize lebih compact
3. Tambahkan contextual empty state message:
   - "No data yet for this period" — neutral gray, centered
   - "Add more leads to see distribution" — dengan link/CTA
4. Unknown/Unspecified/Unassigned data:
   - Selalu tampilkan di paling bawah
   - Style: muted color, dashed border/bar
   - Tooltip dengan suggestion untuk fix data quality

---

## 7. Hover & Interaction Specs

**Bar hover:**
- Bar darkens 10%
- Tooltip muncul di atas bar:
  - Background: #0f1729, white text, radius 6px, padding 6px 10px
  - Content: nama, value, percentage, vs target/last period
  - Arrow pointer at bottom

**Card hover:**
- Border: accent color 20% opacity
- Shadow: `0 4px 16px {accent}08`

**Chart card header — filter dropdown:**
- Same style as main header dropdown
- Options relevant per chart (period, category, etc.)

---

## 8. Responsive Behavior

```
Desktop (≥1280px):
  Row 1: [Sales Performance 3fr] [Top Revenue 2fr]
  Row 2: [Lead Source 1fr] [Classification 1fr] [Stream 1fr]
  
Tablet (768-1279px):
  Row 1: [Sales Performance full]
  Row 2: [Top Revenue full]
  Row 3: [Lead Source 1fr] [Classification 1fr]
  Row 4: [Stream full]

Mobile (≤767px):
  All stacked vertically, full width
  Charts resize proportionally
  Insight callouts tetap visible
```

---

## 9. Anti-patterns — JANGAN Lakukan

- ❌ **Donut/pie chart** untuk data < 6 kategori — pakai horizontal bar + breakdown
- ❌ **Chart tanpa comparative context** — setiap data harus ada pembanding
- ❌ **Legend terpisah di bawah chart** — integrate label langsung di chart (inline legend)
- ❌ **Whitespace besar di dalam card** — chart harus fill 85%+ card area
- ❌ **Vertical bar chart untuk < 5 items** — horizontal bar lebih readable
- ❌ **Warna random** — semua dari palette yang sudah defined
- ❌ **Rotated text untuk axis labels** — kalau perlu rotate, chart-nya yang salah
- ❌ **Chart tanpa insight** — setiap chart harus punya 1 auto-generated callout
- ❌ **Unknown/Unassigned ditampilkan biasa** — harus flag sebagai data quality issue
- ❌ **Y-axis label "Rp 750M" dengan line break** — format harus fit 1 baris

---

## 10. Full Checklist

### Chart Design:
- [ ] Sales Performance: horizontal grouped bar, ghost target bar, color by achievement
- [ ] Top Revenue: horizontal ranked bar, rank numbers, gradient bars
- [ ] Lead Source: BUKAN donut → stacked bar + breakdown list with change indicators
- [ ] Classification: BUKAN donut → segmented bar + 3 metric mini cards
- [ ] Stream: horizontal bar with inline labels + percentage

### Data Quality:
- [ ] Unknown/Unassigned/Unspecified selalu muted style + warning indicator
- [ ] Empty states punya contextual message + suggestion
- [ ] Data < 3 items: chart compact, tidak boros space

### Actionability:
- [ ] Setiap chart punya 1 auto-generated insight callout
- [ ] Comparative context tersedia (vs target / vs last period)
- [ ] Color coding bermakna (hijau = good, merah = attention, abu = data issue)

### Visual Polish:
- [ ] Semua chart pakai design token yang sama (radius, shadow, padding)
- [ ] Chart fill 85%+ card area (minimal whitespace)
- [ ] Hover states konsisten (tooltip, bar darkening)
- [ ] Gap antar cards: 10px
- [ ] Card padding: 16px
- [ ] Font sizes konsisten (title 12.5px, subtitle 10.5px, labels 10px)

### Language:
- [ ] Full English, zero mixed language
- [ ] Subtitle informatif: "Origin channel distribution", bukan "Distribusi lead per channel"
- [ ] Insight callouts dalam English
