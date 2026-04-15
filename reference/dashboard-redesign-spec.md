> Historical design brief: this file captures redesign intent, not the canonical implemented system state.
> Use [docs/leadengine-system-overview.md](D:\Website\Group Lead 2026\docs\leadengine-system-overview.md) for current system truth.

# Performance Dashboard — UI/UX Redesign Specification v2

> **Prompt & spec untuk IDE agent (Cursor, Windsurf, Copilot, dll) — revisi dashboard Performance pada platform CRM/Lead Tracker.**

---

## 1. Context & Objective

Platform CRM/Lead Tracker membutuhkan redesign Performance Dashboard. Masalah utama di versi sebelumnya:

- KPI cards terlalu plain dan padding atas-bawah tidak proporsional (terlalu besar dibanding kiri-kanan)
- Header tidak sticky — saat scroll, user kehilangan context judul dan filter
- Terminologi tidak sesuai standar global CRM
- Bahasa campur Indonesia + English
- Pipeline stages urutan terbalik
- Color palette tidak kohesif

**Goal:** Dashboard modern, compact, profesional, sesuai standar SaaS global — dengan kartu KPI yang memiliki visual depth, header sticky dengan efek blur saat scroll, dan spacing proporsional.

---

## 2. Design System & Tokens

### 2.1 Spacing System (8px grid, compact variant)

```
xs:   4px
sm:   6px     ← compact card internal gaps
md:   10px    ← gap antar cards & sections
base: 12px    ← card padding horizontal & vertical
lg:   16px
xl:   24px    ← main content padding
2xl:  32px
```

**KPI Card Padding — CRITICAL:**
```
padding: 12px 14px 10px
```
- Top: 12px (BUKAN 22px — ini yang sebelumnya terlalu besar)
- Horizontal: 14px
- Bottom: 10px
- Rasio vertical:horizontal ≈ 0.8:1 — ini yang membuat proporsional
- Internal gap antar elemen: 4px (BUKAN 10px)

### 2.2 Color Palette

```css
/* ── Base ── */
--bg-page:         #f2f3f6;
--bg-card:         #ffffff;
--bg-sidebar:      #0f1729;

/* ── Text ── */
--text-primary:    #0f1729;
--text-secondary:  #8892a4;
--text-muted:      #94a3b8;
--text-dim:        #5a6178;

/* ── Card Accents (unique per KPI) ── */
--accent-leads:      #6366f1;  /* Indigo */
--accent-revenue:    #0ea5e9;  /* Sky */
--accent-winrate:    #10b981;  /* Emerald */
--accent-conversion: #8b5cf6;  /* Violet */
--accent-dealsize:   #f59e0b;  /* Amber */

/* ── Semantic ── */
--positive:        #10b981;
--negative:        #ef4444;
--warning:         #f59e0b;
--info:            #0ea5e9;

/* ── Border & Surface ── */
--border:          #e5e8ed;
--border-light:    #f1f3f5;
--surface-hover:   rgba(255,255,255, 0.04);  /* sidebar */
```

### 2.3 Typography

```css
font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;

/* Sizes */
--text-2xs:  9px;     /* chart axis labels */
--text-xs:   10px;    /* badges */
--text-sm:   10.5px;  /* KPI label, metadata */
--text-base: 11.5px;  /* body, dropdowns */
--text-md:   12.5px;  /* section titles */
--text-lg:   15px;    /* header scrolled */
--text-xl:   19px;    /* header default */
--text-kpi:  26px;    /* KPI big numbers */
```

### 2.4 Border Radius

```css
--radius-xs:  3px;   /* badges, count pills */
--radius-sm:  6px;   /* sidebar items */
--radius-md:  7px;   /* buttons, dropdowns */
--radius-lg:  10px;  /* cards, panels */
```

---

## 3. Sticky Header

Header HARUS sticky dan berubah tampilan saat user scroll.

### Default state (scroll = 0):
```
position: sticky
top: 0
z-index: 20
padding: 20px 24px 12px
background: #f2f3f6 (solid, match page bg)
border-bottom: 1px solid transparent
```
- Title: 19px, weight 800
- Subtitle: "Strategic sales & pipeline analytics" — visible, 11.5px

### Scrolled state (scrollTop > 10px):
```
padding: 10px 24px
background: rgba(242,243,246, 0.88)
backdrop-filter: blur(14px)
-webkit-backdrop-filter: blur(14px)
border-bottom: 1px solid #dfe2e7
```
- Title shrinks: 15px
- Subtitle: collapses (maxHeight 0, opacity 0) — BUKAN display:none, pakai transisi smooth

### Transition:
```
transition: all 0.22s ease
```
Title font-size juga harus transisi smooth.

### Detection:
```javascript
const mainRef = useRef(null);
useEffect(() => {
  const el = mainRef.current;
  const handler = () => setScrolled(el.scrollTop > 10);
  el.addEventListener("scroll", handler, { passive: true });
  return () => el.removeEventListener("scroll", handler);
}, []);
```

---

## 4. KPI Cards — Detailed Spec

### 4.1 Terminologi

| Label Lama | Label Baru |
|---|---|
| TOTAL INQUIRY | **Total Leads** |
| TOTAL REVENUE (WON) | **Won Revenue** |
| WIN RATE | **Deal Win Rate** |
| CONVERSION | **Lead Conversion** |
| AVG PROJECT SIZE | **Avg Deal Size** |

### 4.2 Card Visual Design

Setiap card punya **3 elemen visual pembeda** agar tidak plain:

**A. Accent Top Bar**
```
position: absolute
top: 0; left: 0; right: 0
height: 2.5px
background: linear-gradient(90deg, {accent}, {accent}66)
opacity: 0.5 → 1 on hover
transition: opacity 0.2s
```
Warna accent berbeda per card (lihat palette section 2.2).

**B. Icon Badge (kanan atas)**
```
width: 22px; height: 22px
border-radius: 6px
background: {accent} + "0c"  ← 5% opacity of accent
color: {accent}
font-size: 11px
```
Menampilkan icon yang merepresentasikan metrik.

**C. Hover Effect**
```
transform: translateY(-2px)
border-color: {accent}35  ← 21% opacity of accent
box-shadow: 0 6px 20px {accent}10, 0 1px 4px rgba(0,0,0,.04)
```

### 4.3 Card Internal Layout

```
┌─ accent bar (2.5px) ─────────────────┐
│                                       │
│  Label (10.5px, 600)    [icon 22×22] │
│                                       │
│  Rp 2.9B (26px, 800)                │
│                                       │
│  [▲ 5.0% target] [▲ 24.8% YoY]     │
│                                       │
└───────────────────────────────────────┘

padding: 12px 14px 10px
gap between elements: 4px
```

### 4.4 Stagger Animation
```
delay per card: 60ms (card 0=0ms, 1=60ms, 2=120ms, ...)
animation: opacity 0→1, translateY(8px→0)
duration: 0.25s ease
```

### 4.5 Badge / Indicator
```
font-size: 10px
font-weight: 600
padding: 1px 5px
border-radius: 4px
gap between badges: 3px
arrow icon: 7px font-size

Positive: color #10b981, bg rgba(16,185,129, 0.07)
Negative: color #ef4444, bg rgba(239,68,68, 0.07)
```

### 4.6 Grid Layout
```
display: grid
grid-template-columns: repeat(5, 1fr)
gap: 10px
margin-bottom: 12px
```

---

## 5. Revenue Chart

```
Grid: span 2 columns
Card padding: 16px 16px 14px
Border-radius: 10px
```

- Title: 12.5px, bold 700
- Subtitle: 10.5px
- Year selector: 11px, bg `#f4f5f7`, padding `3px 9px`, radius 5px
- Legend: di atas chart, 9.5px
- Chart height: 190px
- Y-axis labels: 9px
- X-axis labels: 9px
- Bar actual: width 20px, `#6366f1`, radius `3px 3px 0 0`
- Bar last year: width 12px, `#ddd6fe`, beside actual
- Target: dashed line 1.5px `#c0c7d2`
- Tooltip: bg `#0f1729`, padding `6px 9px`, radius 6px, font 9.5px

---

## 6. Pipeline Stages

```
Card padding: 16px
Border-radius: 10px
```

- Title: 12.5px, bold 700
- Subtitle: "Lead distribution by stage" — 10.5px (FULL ENGLISH)
- Stage label: 11px, weight 500
- Count pill: 10px, bold 700, white text on colored bg, radius 3px, padding `0 5px`
- Progress bar: height 5px, bg `#f1f3f5`, radius 3px
- Fill: `linear-gradient(90deg, {color}, {color}bb)`
- Gap antar stages: 10px

**URUTAN FUNNEL (atas ke bawah):**
1. New Lead → `#6366f1`
2. Qualified → `#8b5cf6`
3. Proposal Sent → `#f59e0b`
4. Negotiation → `#0ea5e9`
5. Closed Won → `#10b981`
6. Closed Lost → `#ef4444`

---

## 7. Sidebar

```
width: 218px
background: #0f1729
```

- Brand logo: 32×32px, radius 8px
- Brand name: 13px, bold 700
- Entity switcher: "All Companies", radius 7px, padding `7px 9px`
- Nav items: 12.5px, radius 6px, padding `7px 9px`
- Active: bg `rgba(99,102,241,.13)`, color `#a5b4fc`
- Theme: "Light Mode" (BUKAN "Switch to Light Panel"), 10.5px
- User avatar: 28×28px, radius 6px

---

## 8. Responsive Behavior

```
≥1280px: Full layout
768-1279px:
  - Sidebar: icon-only (48px)
  - KPI cards: 3 + 2 columns
  - Charts: stacked vertically
≤767px:
  - Sidebar: hidden + hamburger
  - KPI cards: 2 columns, horizontal scroll
  - Charts: full width stacked
  - Sticky header tetap aktif
```

---

## 9. Do's and Don'ts

### DO:
- ✅ Padding card proporsional (V ≈ 0.8× H)
- ✅ Accent bar unik per card untuk visual depth
- ✅ Sticky header dengan blur transition
- ✅ Semua English, konsisten
- ✅ Pipeline stages sesuai urutan funnel
- ✅ Default filter "This Quarter"
- ✅ Badge indicators terpisah visual
- ✅ Hover states dengan elevation + accent border
- ✅ Compact spacing (10px gaps, 12px card padding)

### DON'T:
- ❌ Card padding atas-bawah > kiri-kanan
- ❌ Card tanpa visual differentiator (plain white box)
- ❌ Header yang hilang saat scroll
- ❌ Campur bahasa Indonesia + English
- ❌ "Inquiry" → pakai "Leads"
- ❌ "Project Size" → pakai "Deal Size"
- ❌ "Switch to Light Panel" → pakai "Light Mode"
- ❌ Default ke "All Time"
- ❌ Pipeline Closed Won di atas
- ❌ Dua indicator tanpa visual separation
- ❌ Font generic (Inter, Roboto, Arial)
- ❌ Gap antar cards > 12px (terlalu lebar untuk compact dashboard)

---

## 10. Checklist

- [ ] KPI card padding: 12px 14px 10px (proporsional)
- [ ] Setiap card punya accent top bar + icon badge
- [ ] Header sticky dengan blur on scroll
- [ ] Subtitle collapses smooth saat scroll
- [ ] Terminologi sesuai tabel section 4.1
- [ ] Full English, zero mixed language
- [ ] Pipeline stages top-down funnel order
- [ ] Period filter default "This Quarter"
- [ ] Hover states: card elevation + accent border
- [ ] Stagger animation on page load
- [ ] Gap 10px antar cards, 12px antar sections
- [ ] Responsive breakpoints implemented
