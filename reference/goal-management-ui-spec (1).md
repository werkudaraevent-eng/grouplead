# Goal Management — UI/UX Specification

> **Prompt untuk IDE agent — halaman Goal Management dengan matrix table view, tree hierarchy collapsible, monthly breakdown, dan inline editing. Termasuk goal configuration side panel.**

---

## 1. Page Overview

URL: `/goals`
Nav: Tambahkan "Goals" di sidebar menu, di bawah "Pipeline" dan di atas "Companies".
Icon: Target/crosshair icon.

Halaman ini punya **2 mode** yang diakses dari satu page:

1. **Matrix View** (default) — tabel matrix read/edit dengan tree hierarchy di rows dan bulan di columns
2. **Goal Configuration** — side panel atau modal untuk setup goal structure (hierarchy levels, nodes, user assignments)

---

## 2. Page Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STICKY HEADER (fixed height: 64px)                                     │
│  Revenue Goal Matrix                                        [Export ↓]  │
│  Break down revenue targets and compare monthly performance  [⚙ Config]│
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  TOOLBAR                                                                │
│  ┌─────────────────────┐ ┌────────────────┐ ┌─────────────────────┐    │
│  │ HIERARCHY LEVELS     │ │ TIMEFRAME      │ │ DISPLAY METRICS     │    │
│  │ [Stream]→[Region]→   │ │ 📅 2026        │ │ [Nominal][%][Both]  │    │
│  │ [Source]→[+Add Level]│ │                │ │                     │    │
│  └─────────────────────┘ └────────────────┘ └─────────────────────┘    │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  TAB BAR                                                                │
│  [Revenue Breakdown]  [Cost Allocation]  [Profit Margin]                │
│                                                    🔍 Search  ↕ Collapse│
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  MATRIX TABLE                                                           │
│  ┌──────────────────┬────────┬────────┬────────┬─── ─┬────────┬──────┐ │
│  │ ROW HIERARCHY     │ JAN    │ FEB    │ MAR    │ ... │ Q1 TOT │ YTD  │ │
│  ├──────────────────┼────────┼────────┼────────┼─────┼────────┼──────┤ │
│  │ ▾ L1 MICE         │ Rp350M │ Rp400M │ Rp350M │     │ Rp1.1B │Rp2.1B│ │
│  │   ▾ L2 East       │  24%   │  27%   │  24%   │     │   76%  │ 100% │ │
│  │     L3 Jakarta    │ Rp200M │ Rp250M │ Rp200M │     │ Rp650M │Rp850M│ │
│  │     L3 Overseas   │  57%   │  62%   │  57%   │     │   59%  │  58% │ │
│  │   ▸ L2 West       │ Rp150M │ Rp150M │ Rp150M │     │ Rp450M │Rp600M│ │
│  │ ▸ L1 Travel       │ Rp500M │ Rp600M │ Rp500M │     │ Rp1.6B │Rp2.1B│ │
│  │ ▸ L1 Creative     │ ...    │ ...    │ ...    │     │ ...    │ ...  │ │
│  └──────────────────┴────────┴────────┴────────┴─────┴────────┴──────┘ │
│                                                                          │
│  SUMMARY ROW (sticky bottom)                                            │
│  ┌──────────────────┬────────┬────────┬────────┬─────┬────────┬──────┐ │
│  │ TOTAL             │ Rp2.1B │ Rp2.5B │ Rp2.1B │     │ Rp6.7B │Rp12B │ │
│  └──────────────────┴────────┴────────┴────────┴─────┴────────┴──────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Design Tokens

Referensi: `design-system.md` untuk semua base tokens. Tokens tambahan:

```css
/* Matrix table specific */
--row-height:          48px;
--row-height-compact:  40px;
--header-bg:           #f8f9fb;
--row-hover:           rgba(99,102,241, 0.02);
--row-expanded-bg:     #fafbfc;
--level-indent:        24px;           /* per level indentation */
--column-min-width:    100px;
--hierarchy-col-width: 280px;

/* Level badges */
--level-1-color:       #6366f1;        /* Indigo */
--level-2-color:       #0ea5e9;        /* Sky */
--level-3-color:       #8b5cf6;        /* Violet */
--level-4-color:       #10b981;        /* Emerald */
--level-5-color:       #f59e0b;        /* Amber */

/* Attainment colors */
--attain-exceed:       #10b981;        /* ≥100% */
--attain-ontrack:      #6366f1;        /* 70-99% */
--attain-behind:       #f59e0b;        /* 40-69% */
--attain-critical:     #ef4444;        /* <40% */
```

---

## 4. Sticky Header

Sama pattern dengan dashboard (lihat `design-system.md` — Section 7.14):

```
Height: 64px (FIXED)
Position: sticky, top 0, z-index 20

Left:
  Title: "Revenue Goal Matrix" — 19px → 15px saat scrolled
  Subtitle: collapses saat scrolled (opacity + position absolute)

Right:
  "Export View" — outlined button
  "Manage Goal Configuration" — primary button (⚙ icon)
    Click → opens configuration side panel (Section 11)

Hysteresis: standard (hide subtitle >20px, show <6px)
Backdrop blur saat scrolled
```

---

## 5. Toolbar

Sticky di bawah header. Tidak collapse saat scroll — selalu visible.

```
Position: sticky, top 64px (di bawah header), z-index 18
Background: --bg-page (solid)
Border-bottom: 1px solid --border
Padding: 12px 24px
Display: flex, gap 24px, align-items center, flex-wrap wrap
```

### 5.1 Hierarchy Levels

Menampilkan urutan dimension tree yang aktif. Ini **read-only display** — editing dilakukan di Configuration panel.

```
┌─ HIERARCHY LEVELS ────────────────────────────────────────┐
│  [Stream] → [Region] → [Source Client] → [+ Add Level]   │
└───────────────────────────────────────────────────────────┘

Label: "HIERARCHY LEVELS" — 9.5px, weight 700, uppercase, --text-muted
Chips: each level as a pill
  Background: level color at 10% opacity
  Text: level color at full, 11.5px, weight 600
  Border-radius: 6px
  Padding: 4px 10px
Arrows: → between chips, --text-muted, 11px
"+ Add Level": dashed border pill, --primary color
  Click → opens configuration panel at the levels section

Chips are NOT draggable here — reordering is done in configuration panel.
This is purely a visual indicator of the current structure.
```

### 5.2 Timeframe Setup

```
┌─ TIMEFRAME SETUP ──────────────┐
│  📅 Jan – Dec 2026           ▾ │
└─────────────────────────────────┘

Dropdown trigger: shows current year or date range
Options:
  - Full Year: "2026", "2025", "2024"
  - Custom Range: month picker (from month/year to month/year)

When year selected: table shows JAN-DEC + Q1-Q4 + YTD columns
When custom range: shows only months in range + period total

Label: "TIMEFRAME SETUP" — 9.5px, weight 700, uppercase, --text-muted
Trigger: 12px, weight 600, --text-primary, border 1px --border, radius 8px
  Padding: 6px 12px
  Calendar icon (📅) left
```

### 5.3 Display Metrics

Toggle antara Nominal, Percent, atau Both.

```
┌─ DISPLAY METRICS ─────────────────┐
│  [Nominal]  [Percent]  [● Both]   │
└───────────────────────────────────┘

Segmented control (3 options):
  - "Nominal": show Rp values only
  - "Percent": show % of parent only
  - "Both" (default): show Rp value + % below

Active: bg --primary, text white, weight 600
Inactive: bg transparent, border 1px --border, text --text-secondary
Height: 32px, border-radius: 8px (group), 6px (individual)
Transition: 150ms ease

Label: "DISPLAY METRICS" — 9.5px, weight 700, uppercase, --text-muted
```

---

## 6. Tab Bar

```
[Revenue Breakdown]  [Cost Allocation]  [Profit Margin]

                                          🔍 Search rows    ↕ Collapse All
```

**Tabs:**
```
Active: bottom border 2px --primary, text --primary, weight 600
Inactive: text --text-secondary, weight 400
Font: 13px
Gap: 24px

Note: "Cost Allocation" dan "Profit Margin" bisa di-disable / coming soon
jika belum diimplementasi. Tampilkan sebagai tab disabled dengan tooltip
"Coming soon".
```

**Search:**
```
Right-aligned, inline with tab bar
Input: 200px width, 32px height, placeholder "Search rows"
Search icon (🔍) left inside input
Filters tree rows: match on node name, highlight matching text
Debounce: 300ms
Saat search aktif: auto-expand all matching branches
```

**Collapse All / Expand All:**
```
Toggle button, right of search
"↕ Collapse All" / "↕ Expand All"
Font: 11.5px, weight 500, --text-secondary
Click: collapses or expands all tree nodes
```

---

## 7. Matrix Table — Core Component

### 7.1 Table Structure

```
┌───────────────────┬──────────┬──────────┬──── ──┬──────────┬──────────┬─────────┐
│ ROW HIERARCHY      │ JAN 2026 │ FEB 2026 │ ...  │ DEC 2026 │ Q1 TOTAL │ YTD     │
│ (fixed left)       │          │          │      │          │          │ TOTAL   │
├───────────────────┼──────────┼──────────┼──────┼──────────┼──────────┼─────────┤
│ ▾ L1 MICE          │ 350M/24% │ 400M/27% │      │          │ 1.1B/76% │ 2.1B    │
│   ▾ L2 East        │ 200M/57% │ 250M/62% │      │          │ 650M/59% │ 850M    │
│     L3 Jakarta 👤  │ 120M/60% │ 150M/60% │      │          │ 385M/59% │ 500M    │
│     L3 Overseas 👤 │  80M/40% │ 100M/40% │      │          │ 265M/41% │ 350M    │
│   ▸ L2 West        │ 150M/43% │ 150M/38% │      │          │ 450M/41% │ 600M    │
│ ▸ L1 Travel        │ 500M/23% │ 600M/28% │      │          │ 1.6B/76% │ 2.1B    │
│ ▸ L1 Creative      │          │          │      │          │          │         │
├───────────────────┼──────────┼──────────┼──────┼──────────┼──────────┼─────────┤
│ TOTAL (sticky)     │ 2.1B     │ 2.5B     │      │          │ 6.7B     │ 12B     │
└───────────────────┴──────────┴──────────┴──────┴──────────┴──────────┴─────────┘
```

### 7.2 Column Definitions

```
Fixed columns (always visible, left-pinned):
  - ROW HIERARCHY: width 280px, sticky left

Scrollable month columns:
  - JAN 2026 through DEC 2026: min-width 100px each
  - Content: target value (nominal and/or percentage)

Summary columns (right side):
  - Q1 TOTAL, Q2 TOTAL, Q3 TOTAL, Q4 TOTAL: quarterly sums
  - YTD TOTAL: year-to-date sum
  - Width: 110px each
  - Background: slightly darker (#f8f9fb) to differentiate

Column header:
  Font: 10px, weight 700, uppercase, letter-spacing 0.5px, --text-muted
  Padding: 8px 12px
  Background: --header-bg
  Border-bottom: 1px solid --border
  Text-align: right (for value columns)
  Sticky top: below toolbar (position sticky)
```

### 7.3 Row Hierarchy Column (left-pinned)

```
┌──────────────────────────────────────┐
│ ▾  L1  MICE                          │
│                                       │
│    ▾  L2  East                        │
│                                       │
│       L3  Jakarta  👤 Ahmad R.        │
│                                       │
│       L3  Overseas 👤 Budi S.         │
│                                       │
│    ▸  L2  West                        │  ← collapsed
│                                       │
└──────────────────────────────────────┘

Layout per row:
  Indent: level × 24px (L1 = 0px, L2 = 24px, L3 = 48px, L4 = 72px)
  
  Expand/Collapse chevron (▾/▸):
    - Size: 16px
    - Color: --text-muted
    - Visible only if node has children
    - Click: toggle expand/collapse with smooth animation
    - Rotate: 0° collapsed → 90° expanded, 150ms ease
  
  Level badge:
    - "L1", "L2", "L3", etc.
    - Width: 24px, height: 20px
    - Font: 9px, weight 700
    - Background: level color at 15% opacity
    - Text: level color
    - Border-radius: 4px
    - Margin-right: 8px
  
  Node name:
    - Font: 12.5px, weight 600 (L1), weight 500 (L2+)
    - Color: --text-primary
    - L1 rows: slightly bolder, acts as section header
  
  User avatar (for user_target leaf nodes):
    - 20px circle, border-radius 50%
    - Appears after node name
    - Tooltip: full name + role
  
  Row height: 48px
  Padding: 0 14px
  Border-bottom: 1px solid --border-light
  
  Hover: background --row-hover
  Expanded parent: background --row-expanded-bg (subtle differentiation)
```

### 7.4 Value Cells

Setiap cell menampilkan data berdasarkan Display Metrics toggle:

```
Mode "Nominal" only:
┌──────────┐
│  Rp 350M │
└──────────┘

Mode "Percent" only:
┌──────────┐
│    24%   │
└──────────┘

Mode "Both" (default):
┌──────────┐
│  Rp 350M │
│    24%   │
└──────────┘

Cell specs:
  Text-align: right
  Padding: 8px 12px
  
  Nominal value:
    Font: 12px, weight 600, --text-primary
    Format: compact IDR (Rp 350M, Rp 1.2B, Rp 45.5M)
  
  Percentage:
    Font: 10.5px, weight 500, --text-secondary
    Format: "24%" (percentage of parent's value for that month)
    Margin-top: 2px (below nominal in "Both" mode)
  
  Empty cell (no data / future months):
    Show: "—" in --text-muted, centered
    Or: leave blank with subtle background pattern
```

### 7.5 Cell Coloring (Attainment)

Jika data actual tersedia (bulan yang sudah lewat), cells bisa di-color-code:

```
Kondisi: bulan sudah lewat DAN actual data available

Color rules (background tint, very subtle):
  ≥100% of target: rgba(16,185,129, 0.06)   — green tint
  70-99% of target: rgba(99,102,241, 0.04)   — indigo tint (on track)
  40-69% of target: rgba(245,158,11, 0.06)   — amber tint (behind)
  <40% of target:   rgba(239,68,68, 0.05)    — red tint (critical)

Bulan yang belum lewat: no coloring (target only, no actual)
Current month: subtle left-border 2px --primary (highlight current period)

Attainment mode (optional toggle):
  Saat "Show Attainment" diaktifkan, cells menampilkan:
  ┌──────────┐
  │  Rp 350M │  ← actual revenue
  │  /Rp 400M│  ← target (dimmed)
  │    88%   │  ← attainment percentage
  └──────────┘
```

### 7.6 Summary Row (sticky bottom)

```
Position: sticky, bottom 0
Background: #f0f1f4 (slightly darker than page bg)
Border-top: 2px solid --border
Font: 12.5px, weight 700, --text-primary
Height: 48px

Shows sum of all L1 nodes (root level)
Label: "TOTAL" in hierarchy column
Values: sum per month column
YTD: grand total
```

### 7.7 Inline Editing

Cells yang menampilkan TARGET (bukan actual) bisa di-edit inline:

```
Trigger: double-click pada cell value
  → cell berubah jadi input field
  → auto-focus, select all text
  → border: 1.5px solid --primary
  → background: white

Input behavior:
  - Nominal mode: input angka, auto-format to Rp compact
  - Percentage mode: input percentage, auto-compute nominal
  - Respects node's allocation_mode (percentage vs absolute)
  
  Enter = save, recalculate children cascade
  Escape = cancel, revert to previous value
  Tab = save and move to next cell (right)
  Shift+Tab = save and move to previous cell (left)

After save:
  - Flash animation: brief green highlight then fade
  - All affected children/siblings recalculate immediately
  - Unallocated amount updates in real-time
  
Edit permission:
  - Only admin/super_admin can edit
  - Actual revenue cells are NEVER editable (computed from leads)
  - Summary/total rows are NEVER editable (computed)
```

### 7.8 Horizontal Scrolling

```
Month columns scroll horizontally while hierarchy column stays pinned left.

Hierarchy column: position sticky, left 0, z-index 5
  Background: white (opaque, not transparent — to hide scrolling content behind)
  Box-shadow: 2px 0 8px rgba(0,0,0,.04) — subtle shadow on right edge when scrolled

Summary columns (Q totals, YTD): bisa sticky right ATAU scroll dengan months
  Recommendation: scroll with months (simpler), tapi Q1-Q4 dan YTD kolom 
  punya background sedikit berbeda (#f8f9fb) agar visual distinct

Scroll indicator: subtle fade gradient at left/right edge saat ada hidden content
```

---

## 8. Tree Expand/Collapse Animation

```
Expand:
  - Children rows: height 0 → 48px, opacity 0 → 1
  - Stagger: 30ms delay per child row
  - Duration: 200ms ease
  - Chevron: rotate 0° → 90°, 150ms ease

Collapse:
  - Children rows: height 48px → 0, opacity 1 → 0
  - All at once (no stagger for collapse — feels snappier)
  - Duration: 150ms ease
  - Chevron: rotate 90° → 0°

Nested collapse: collapsing a parent collapses ALL descendants
Nested expand: expanding a parent only shows direct children
  (user must click each child's chevron to go deeper)
```

---

## 9. Unallocated Row

Kalau sum of children < parent target, tampilkan "Unallocated" row:

```
┌──────────────────┬──────────┬──────────┬──────────┐
│ ▾ L1 MICE         │ Rp 350M  │ Rp 400M  │ ...     │
│   L2 East         │ Rp 200M  │ Rp 250M  │         │
│   L2 West         │ Rp 100M  │ Rp 100M  │         │
│   ⚠ Unallocated  │  Rp 50M  │  Rp 50M  │         │  ← warning style
└──────────────────┴──────────┴──────────┴──────────┘

Style:
  Background: rgba(245,158,11, 0.04) — amber tint
  Text: --warning color, italic
  Icon: ⚠ before "Unallocated"
  Font: 11.5px, weight 500
  Not expandable, not editable
  
Over-allocated (sum > parent):
  Same row but:
  Background: rgba(239,68,68, 0.04) — red tint
  Icon: ⚠ with red color
  Label: "Over-allocated by Rp X"
  This is a blocking error — admin must fix before saving
```

---

## 10. Empty States

### No goal configured:
```
Centered in table area
Icon: target/goal illustration, 48px, --text-muted at 30%
Title: "No revenue goal configured" — 15px, weight 600
Subtitle: "Set up your annual target and breakdown structure to start tracking." — 12px
CTA: "[ ⚙ Configure Goal ]" → opens configuration panel
```

### Goal exists but no nodes:
```
Table shows header row + empty body
Message centered in body:
"Goal target set at Rp 117B. Add hierarchy levels to break it down."
CTA: "[ + Add First Level ]"
```

---

## 11. Goal Configuration — Side Panel

Triggered by: "⚙ Manage Goal Configuration" button in header, or "Configure" buttons elsewhere.

```
Width: 540px
Slide from right, 250ms ease-out
Backdrop: rgba(0,0,0, 0.12)
```

### 11.1 Panel Layout

```
┌──────────────────────────────────────────────────────────┐
│  Goal Configuration                                  ✕   │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  GOAL OVERVIEW                                           │
│                                                          │
│  Goal Name                                               │
│  ┌──────────────────────────────────────────┐           │
│  │ Annual Revenue Target 2026               │           │
│  └──────────────────────────────────────────┘           │
│                                                          │
│  Period       Year        Total Target                   │
│  [Yearly ▾]   [2026 ▾]    [Rp 117,000,000,000]         │
│                                                          │
│  Status: ● Active                                        │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  MONTHLY WEIGHT DISTRIBUTION                             │
│                                                          │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┐                │
│  │ Jan │ Feb │ Mar │ Apr │ May │ Jun │                │
│  │ 2%  │ 4%  │ 5%  │ 10% │ 13% │ 14% │                │
│  ├─────┼─────┼─────┼─────┼─────┼─────┤                │
│  │ Jul │ Aug │ Sep │ Oct │ Nov │ Dec │                │
│  │ 15% │ 9%  │ 9%  │ 9%  │ 2%  │ 8%  │                │
│  └─────┴─────┴─────┴─────┴─────┴─────┘                │
│  Total: 100% ✓                                          │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  HIERARCHY STRUCTURE                                     │
│                                                          │
│  Define how the goal breaks down. Drag to reorder.       │
│                                                          │
│  ⠿ Level 1: [Stream Type     ▾]   🗑                   │
│  ⠿ Level 2: [Region          ▾]   🗑                   │
│  ⠿ Level 3: [Source Client   ▾]   🗑                   │
│  ⠿ Level 4: [Sales Person    ▾]   🗑                   │
│                                                          │
│  [+ Add Level]                                           │
│                                                          │
│  Level options:                                          │
│  Subsidiary, Region, Source Client, Destination,         │
│  Stream, Office, Sales Person, Custom                    │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  ALLOCATION MODE (per level)                             │
│                                                          │
│  Default for new nodes: [● Percentage] [Absolute]        │
│                                                          │
│  Note: Each group of siblings can override this.         │
│  When adding nodes, you choose percentage or absolute.   │
│                                                          │
│  ═══════════════════════════════════════════════════════  │
│  ┌──────────┐  ┌──────────────────────┐                 │
│  │  Cancel   │  │  Save Configuration  │                 │
│  └──────────┘  └──────────────────────┘                 │
└──────────────────────────────────────────────────────────┘
```

### 11.2 Goal Overview Section

```
Goal Name: text input, 13px, full width
Period Type: dropdown [Monthly, Quarterly, Yearly]
Year: dropdown [2024, 2025, 2026, 2027]
Total Target: number input with Rp formatting
  - Input: auto-format as user types (1000000 → 1,000,000)
  - Display: compact (Rp 117B) below input as helper text
Status: badge — Active (green), Draft (gray), Closed (muted)
```

### 11.3 Monthly Weight Distribution

```
Grid: 6 columns × 2 rows (12 months)
Each cell:
  - Month label (3-letter): 9.5px, weight 600, --text-muted
  - Input: number field, 2-3 digits, suffix "%"
  - Width: ~60px per cell
  - Height: 48px per cell
  - Border: 1px solid --border-light
  - Editable: click to edit, blur to save
  
Total row:
  - "Total: 100% ✓" — green if sum = 100%
  - "Total: 95% ⚠ (5% unallocated)" — warning if sum ≠ 100%
  - "Total: 105% ❌ (exceeds 100%)" — error if sum > 100%

Tip: "Weights determine how the annual target distributes across months."
```

### 11.4 Hierarchy Structure

```
Ordered list of dimension levels. Drag to reorder.

Each level row:
  ⠿ Drag handle — visible, cursor grab
  "Level N:" label — 11px, weight 600, --text-muted
  Dropdown: dimension type selector
    Options: Subsidiary, Region, Source Client, Destination, 
             Stream, Office, Sales Person, Custom
    Width: 180px
    Shows current selection
  🗑 Delete button — visible on hover, --negative color
    Cannot delete if nodes exist at this level (show tooltip warning)

"+ Add Level" button:
  Font: 11.5px, weight 500, --primary
  Dashed border pill
  
Drag & drop:
  Reorder levels — this changes the tree structure
  IMPORTANT: Reordering levels that already have data requires confirmation:
    "Reordering levels will restructure existing goal nodes. 
     Some data may need manual re-assignment. Continue?"
    [Cancel] [Continue]

Max levels: 8 (practical limit)
```

### 11.5 Allocation Mode Default

```
Segmented control: [Percentage] [Absolute]
Default: Percentage

This sets the DEFAULT mode when creating new nodes.
Individual node groups can override this in the matrix table
(via right-click → "Switch to Absolute/Percentage" on a parent node).
```

---

## 12. Adding Nodes (In Matrix Table)

Saat tree sudah di-setup via configuration, admin perlu populate nodes.

### 12.1 Add Node — Inline Row

```
Di bawah setiap expandable parent, ada row "+ Add {dimension_type}":

┌──────────────────────────────────────────────────────────────────┐
│ ▾ L1 MICE                                                        │
│   L2 East        │ ...                                           │
│   L2 West        │ ...                                           │
│   + Add Region   │                    ← click to add new L2 node │
└──────────────────────────────────────────────────────────────────┘

Click → inline input row appears:
┌──────────────────────────────────────────────────────────────────┐
│   [Enter region name...] [Rp _____ or ___%]  [✓ Save] [✕ Cancel]│
└──────────────────────────────────────────────────────────────────┘

Specs:
  - Name input: 12px, placeholder "Enter {dimension_type} name..."
  - Value input: depends on allocation_mode
    - Percentage mode: input with "%" suffix
    - Absolute mode: input with "Rp" prefix
  - Save (✓): --primary, compact button
  - Cancel (✕): --text-muted
  - Auto-focus on name input
  - Enter = save
  - Escape = cancel

After save:
  - New row appears in tree
  - All month columns auto-compute based on allocation
  - Parent's "Unallocated" row updates
```

### 12.2 Add from Existing Values

Saat dimension type punya `reference_field` (e.g., "stream" → `leads.stream_type`), system bisa suggest values:

```
Name input → dropdown with suggestions from master_options or distinct lead values:
  "MICE", "Travel", "Creative", "Retail", "Training", "Wellness"
  
Admin bisa pilih dari suggestion atau ketik custom name.
Suggestion shows: name + lead count (e.g., "MICE (42 leads)")
```

---

## 13. Right-Click Context Menu

Right-click pada row di hierarchy column:

```
┌──────────────────────────────┐
│  Edit Node Name              │
│  Change Color                │
│  ────────────────────────    │
│  Switch to Absolute Mode     │  ← toggle allocation mode for this node's children
│  ────────────────────────    │
│  Add Child Node              │
│  Assign Sales Person         │  ← opens user picker
│  ────────────────────────    │
│  Duplicate Branch            │  ← copy this node + all children
│  Move to Different Parent    │
│  ────────────────────────    │
│  Delete Node                 │  ← red, with confirmation
└──────────────────────────────┘

Style: standard context menu
  Background: white
  Border: 1px solid --border
  Border-radius: 8px
  Shadow: --shadow-md
  Item: padding 8px 14px, 12px, hover bg --bg-subtle
  Dividers: 1px solid --border-light
  Destructive items: --negative color
```

---

## 14. Responsive Behavior

```
Desktop (≥1280px):
  Full layout, all month columns visible (scroll horizontally if needed)
  Side panel: 540px
  
Tablet (768-1279px):
  Hierarchy column: 240px (narrower)
  Month columns: scroll horizontally
  Side panel: 440px
  Toolbar: wraps to 2 lines

Mobile (≤767px):
  Hierarchy column: full width
  Month columns: horizontal scroll, or switch to vertical list view
  Side panel: full width (bottom sheet)
  Toolbar: stacked vertically, each control full width
  "Both" display mode: forced to "Nominal" only (space constraint)
```

---

## 15. Data Flow

### Read:
```
1. Fetch goal for active company + selected year
2. Fetch all goal_nodes for that goal (flat list)
3. Build tree using buildGoalTree()
4. Fetch actual revenue per node using ancestor path + reference fields
5. Compute attainment per cell (actual / target)
6. Render matrix
```

### Write (inline edit):
```
1. User edits a cell → determine node + month
2. If percentage mode: 
   - Save new percentage → compute target_amount
   - Cascade recalculate all descendants
3. If absolute mode:
   - Save new target_amount → compute percentage for display
   - Check: sum of siblings ≤ parent target
4. Update all affected cells in UI immediately (optimistic)
5. Save to database (debounced batch update)
6. If save fails: revert UI, show error toast
```

---

## 16. Keyboard Navigation

```
Arrow keys: navigate between cells
Enter: enter edit mode on current cell (or save if already editing)
Escape: cancel edit
Tab: move to next cell (right), wrap to next row
Shift+Tab: move to previous cell
Space: toggle expand/collapse on hierarchy rows
Home: jump to first cell in row
End: jump to last cell in row
```

---

## 17. File Structure

```
src/
├── app/goals/page.tsx                     # Goals page (server component, fetch initial data)
├── features/goals/components/
│   ├── goal-matrix.tsx                    # Main matrix table component
│   ├── goal-matrix-header.tsx             # Sticky header with title + buttons
│   ├── goal-matrix-toolbar.tsx            # Hierarchy levels + timeframe + display toggle
│   ├── goal-matrix-table.tsx              # The actual table with virtual scrolling
│   ├── goal-matrix-row.tsx                # Single row (hierarchy + value cells)
│   ├── goal-matrix-cell.tsx               # Single value cell (nominal/percent/both)
│   ├── goal-matrix-cell-editor.tsx        # Inline cell editor
│   ├── goal-hierarchy-column.tsx          # Left-pinned tree column
│   ├── goal-summary-row.tsx              # Sticky bottom total row
│   ├── goal-unallocated-row.tsx          # Warning row for unallocated amounts
│   ├── goal-config-panel.tsx             # Side panel for goal configuration
│   ├── goal-config-overview.tsx          # Goal name, period, total target
│   ├── goal-config-weights.tsx           # Monthly weight distribution grid
│   ├── goal-config-hierarchy.tsx         # Hierarchy level ordering
│   ├── goal-add-node-row.tsx             # Inline "add node" row
│   └── goal-context-menu.tsx             # Right-click context menu
├── hooks/
│   ├── use-goal.ts                        # Fetch goal + nodes + build tree
│   ├── use-goal-matrix.ts                 # Matrix-specific state (expand, edit, scroll)
│   └── use-goal-recalculate.ts           # Cascade recalculation logic
└── types/
    └── goals.ts                           # (already defined in goal-system-redesign-spec)
```

---

## 18. Checklist

### Page Structure:
- [ ] Sticky header (64px, blur on scroll, hysteresis)
- [ ] Toolbar (hierarchy pills, timeframe picker, display metrics toggle)
- [ ] Tab bar (Revenue Breakdown active, others coming soon)
- [ ] Search rows + Collapse All toggle

### Matrix Table:
- [ ] Tree hierarchy in left-pinned column with indentation per level
- [ ] Level badges (L1, L2, L3) with dimension-specific colors
- [ ] Expand/collapse chevrons with animation
- [ ] Month columns (JAN-DEC) with horizontal scroll
- [ ] Quarterly totals (Q1-Q4) and YTD total columns
- [ ] Summary row (sticky bottom)
- [ ] Display metrics toggle: Nominal / Percent / Both
- [ ] Cell coloring based on attainment (green/indigo/amber/red tints)
- [ ] Current month highlight (left border accent)

### Inline Editing:
- [ ] Double-click to edit target cells
- [ ] Respects allocation_mode (percentage vs absolute)
- [ ] Cascade recalculation on save
- [ ] Tab/Shift+Tab navigation between cells
- [ ] Keyboard navigation (arrows, Enter, Escape)
- [ ] Optimistic UI update + debounced save

### Tree Management:
- [ ] "+ Add {dimension}" inline row below each parent
- [ ] Suggestions from master_options / lead field values
- [ ] Right-click context menu (edit, delete, switch mode, assign user)
- [ ] Unallocated row warning (amber) and over-allocated error (red)

### Configuration Panel:
- [ ] Goal overview (name, period, year, total target, status)
- [ ] Monthly weight distribution grid (12 cells, sum validation)
- [ ] Hierarchy level ordering (drag to reorder)
- [ ] Allocation mode default (percentage vs absolute)
- [ ] Save with recalculation

### General:
- [ ] Empty states (no goal, goal but no nodes)
- [ ] Responsive (tablet: narrower columns, mobile: vertical list)
- [ ] Permission gated (admin/super_admin for editing)
- [ ] Export View button (CSV/Excel)
