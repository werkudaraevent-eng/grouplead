# Goal Settings — UI/UX Specification

> **Prompt untuk IDE agent — redesign Goal Settings page sebagai dedicated configuration page yang terpisah dari Goal Matrix. Admin bisa visually design goal hierarchy, manage nodes per level, set monthly weights, dan preview structure sebelum apply.**

---

## 1. Problem dengan Design Saat Ini

1. **Mixing config dan data di satu page** — hierarchy level chips, monthly weights dropdown, dan matrix data semua ada di satu halaman. Admin bingung mana yang setup structure, mana yang isi angka.
2. **Hierarchy setup terlalu subtle** — chips kecil "L1 Subsidiary × → L2 Segment ×" di toolbar tidak menjelaskan apa yang terjadi. Admin tidak bisa preview bagaimana tree akan terbentuk.
3. **Monthly weights tersembunyi** — ada di dropdown kecil di pojok kanan. Padahal ini konfigurasi fundamental yang menentukan distribusi target.
4. **Tidak ada visual feedback** — saat admin menambah level, tidak ada preview real-time bagaimana data akan ter-breakdown.
5. **Node management tidak jelas** — bagaimana admin menambah/menghapus node di setiap level? Dari mana datanya? Apakah dari master data atau manual?

---

## 2. Design Approach — 2-Page Separation

```
/goals                → Goal Matrix (data view + inline edit)
/settings/goals       → Goal Settings (structure config) ← THIS SPEC

Goal Matrix: "Saya mau LIHAT dan EDIT angka target"
Goal Settings: "Saya mau DESAIN bagaimana target di-breakdown"
```

**Navigasi:**
- Sidebar: "Goal Settings" di bawah "Settings" section
- Di Goal Matrix page: tombol "⚙ Manage Goal Configuration" → navigate ke `/settings/goals`
- Di Goal Settings page: tombol "📊 View Matrix" → navigate ke `/goals`

---

## 3. Page Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STICKY HEADER                                                          │
│  Goal Configuration                                    [📊 View Matrix] │
│  Design your revenue target breakdown structure                         │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─── GOAL OVERVIEW CARD ───────────────────────────────────────────┐  │
│  │                                                                   │  │
│  │  2026 Annual Target          Status: ● Active        [Edit Goal] │  │
│  │  Rp 130.0B                   Period: Yearly                      │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─── LEFT (60%) ──────────────────┐  ┌─── RIGHT (40%) ────────────┐  │
│  │                                  │  │                             │  │
│  │  HIERARCHY BUILDER               │  │  LIVE TREE PREVIEW          │  │
│  │  (drag to reorder levels)        │  │  (auto-updates as admin     │  │
│  │                                  │  │   changes structure)        │  │
│  │  ┌─ Level 1 ──────────────┐    │  │                             │  │
│  │  │ ⠿ Subsidiary         ▾ │    │  │   Company Goal              │  │
│  │  │   6 nodes configured    │    │  │   ├─ WNS                   │  │
│  │  │   [Manage Nodes →]      │    │  │   │  ├─ MICE              │  │
│  │  └────────────────────────┘    │  │   │  ├─ Travel            │  │
│  │                                  │  │   │  └─ Creative         │  │
│  │  ┌─ Level 2 ──────────────┐    │  │   ├─ WNW                  │  │
│  │  │ ⠿ Segment             ▾ │    │  │   │  ├─ MICE             │  │
│  │  │   7 nodes configured    │    │  │   │  └─ ...              │  │
│  │  │   [Manage Nodes →]      │    │  │   └─ Jogja               │  │
│  │  └────────────────────────┘    │  │      └─ ...               │  │
│  │                                  │  │                             │  │
│  │  [+ Add Level]                   │  │  Depth: 2 levels           │  │
│  │                                  │  │  Total nodes: 48           │  │
│  │                                  │  │  Leaf nodes: 42            │  │
│  │                                  │  │                             │  │
│  └──────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                          │
│  ┌─── MONTHLY WEIGHT DISTRIBUTION ──────────────────────────────────┐  │
│  │                                                                   │  │
│  │  How should the annual target distribute across months?           │  │
│  │                                                                   │  │
│  │  [Equal] [Seasonal] [Custom]     Total: 100% ✓                  │  │
│  │                                                                   │  │
│  │  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐      │  │
│  │  │ Jan │ Feb │ Mar │ Apr │ May │ Jun │ Jul │ Aug │ ... │      │  │
│  │  │ 2%  │ 4%  │ 5%  │ 10% │ 13% │ 14% │ 15% │ 9%  │     │      │  │
│  │  │10.8B│21.7B│27.1B│54.2B│     │     │     │     │     │      │  │
│  │  └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘      │  │
│  │                                                                   │  │
│  │  ▁▂▃▅▆▇█▅▅▅▁▄  ← visual bar chart of weights                  │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─── ALLOCATION DEFAULTS ──────────────────────────────────────────┐  │
│  │                                                                   │  │
│  │  Default mode: [● Percentage] [Absolute]                          │  │
│  │  Each node group can override this in the matrix.                 │  │
│  │                                                                   │  │
│  │  Attribution basis: [● Event Date] [Closed Won Date]              │  │
│  │  Determines which period a deal's revenue counts toward.          │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Design Tokens

Referensi `design-system.md` untuk base tokens. Tambahan:

```css
/* Level colors (consistent with matrix page) */
--level-1:    #6366f1;
--level-2:    #0ea5e9;
--level-3:    #8b5cf6;
--level-4:    #10b981;
--level-5:    #f59e0b;
--level-6:    #ec4899;
--level-7:    #f97316;
--level-8:    #14b8a6;

/* Weights bar chart */
--weight-bar: #6366f1;
--weight-bar-hover: #4f46e5;

/* Tree preview */
--tree-line:  #d1d5db;
--tree-dot:   8px;
```

---

## 5. Goal Overview Card

Compact card di atas page yang menunjukkan goal aktif. Bisa di-edit inline.

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  📎 2026 Annual Target                 Status: ● Active   [Edit ✎]  │
│                                                                      │
│  Total Target         Period          Created by                     │
│  Rp 130.0B            Yearly 2026     Hanung S. · 12 Mar 2026       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

Specs:
  Card: bg white, border 1px --border, radius 10px, padding 16px 20px
  Shadow: --shadow-xs
  
  Goal name: 15px, weight 700, --text-primary
  
  Metric row (3 columns):
    Total Target: 22px, weight 800, --text-primary (Rp 130.0B)
    Period: 13px, weight 500, --text-secondary (Yearly 2026)
    Created by: 12px, weight 400, --text-muted
  
  Status badge:
    Active: green dot + "Active", bg --positive-bg, text --positive
    Draft: gray dot + "Draft"
    Closed: muted dot + "Closed"
  
  [Edit ✎] button:
    Ghost style, --primary, 11.5px
    Click → opens inline edit or small modal for: name, target amount, period, status
```

---

## 6. Hierarchy Builder (Left Panel)

Ini komponen paling penting — di sini admin mendesain breakdown structure.

### 6.1 Layout

```
┌─ HIERARCHY BUILDER ──────────────────────────────────────┐
│                                                           │
│  Define how your revenue target breaks down.              │
│  Drag levels to reorder. Click "Manage Nodes" to          │
│  add items at each level.                                 │
│                                                           │
│  ┌─ Level 1 ─────────────────────────────────────────┐  │
│  │                                                     │  │
│  │  ⠿  L1  Subsidiary                           ▾  🗑 │  │
│  │                                                     │  │
│  │  Source: companies table (subsidiaries)              │  │
│  │  6 nodes · Allocation: Percentage                   │  │
│  │                                                     │  │
│  │  ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐│  │
│  │  │ WNS  ││ WNW  ││Jogja ││ TEE  ││ UK   ││ +    ││  │
│  │  └──────┘└──────┘└──────┘└──────┘└──────┘└──────┘│  │
│  │                                                     │  │
│  │  [Manage Nodes →]                                   │  │
│  │                                                     │  │
│  └─────────────────────────────────────────────────────┘  │
│          │                                                 │
│          ↓ arrow connector                                │
│          │                                                 │
│  ┌─ Level 2 ─────────────────────────────────────────┐  │
│  │                                                     │  │
│  │  ⠿  L2  Segment                              ▾  🗑 │  │
│  │                                                     │  │
│  │  Source: leads.category field                       │  │
│  │  7 nodes per parent · Allocation: Percentage        │  │
│  │                                                     │  │
│  │  ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐         │  │
│  │  │ MICE ││Travel││Creati││Retail││Train ││  ...    │  │
│  │  └──────┘└──────┘└──────┘└──────┘└──────┘         │  │
│  │                                                     │  │
│  │  [Manage Nodes →]                                   │  │
│  │                                                     │  │
│  └─────────────────────────────────────────────────────┘  │
│          │                                                 │
│          ↓                                                │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  + Add Level                                       │  │
│  │  Choose a dimension to break down further           │  │
│  └───────────────────────────────────────────────────┘  │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 6.2 Level Card Specs

```
Card:
  Background: white
  Border: 1px solid --border
  Border-left: 3px solid {level-color} (L1 = indigo, L2 = sky, etc.)
  Border-radius: 10px
  Padding: 14px 16px
  Margin-bottom: 0 (connected by arrow)

Header row:
  ⠿ Drag handle: 14px, --text-muted, cursor grab
  Level badge: "L1" — same style as matrix (24px wide, level color bg)
  Dimension name: 13px, weight 600, --text-primary
  Dropdown (▾): click to change dimension type
    Options: Subsidiary, Region, Source Client, Destination, Stream, 
             Area, Sector, Line Industry, Office, Sales Person, Custom
    Each option shows: name + which field it maps to
      e.g., "Stream → leads.stream_type"
           "Region → leads.area"
           "Subsidiary → companies table"
           "Sales Person → profiles table"
           "Custom → manual entry (no field mapping)"
  🗑 Delete: visible on hover, --negative, with confirmation

Meta row:
  Source: "leads.category field" — 10.5px, --text-muted, italic
  Node count: "6 nodes" — 10.5px, --text-secondary
  Allocation mode: "Percentage" or "Absolute" — as a small toggle or badge
  Separator: " · " between items

Node preview (chip row):
  Horizontal scrollable row of mini chips showing existing nodes
  Each chip:
    Background: level-color at 8% opacity
    Text: 10px, weight 500, level-color
    Padding: 2px 6px
    Border-radius: 4px
    Max visible: 6 chips + "+N more" if overflow
  "+ " chip: dashed border, --primary, click → opens Manage Nodes

"Manage Nodes →" link:
  Font: 11.5px, weight 600, --primary
  Click → opens Node Manager side panel (Section 8)
```

### 6.3 Arrow Connectors Between Levels

```
Between each level card, show a visual connector:

  ┌─ Level 1 ─┐
  └────────────┘
        │
        ↓  (dashed line + arrow)
        │
  ┌─ Level 2 ─┐
  └────────────┘

Specs:
  Line: 1.5px dashed --tree-line (#d1d5db)
  Length: 24px
  Arrow: small chevron (▼) at bottom, 8px, --tree-line
  Centered horizontally with cards
```

### 6.4 "+ Add Level" Button

```
┌───────────────────────────────────────────────┐
│  + Add Level                                   │
│  Choose a dimension to break down further       │
└───────────────────────────────────────────────┘

Style:
  Border: 2px dashed #c7d2fe
  Background: transparent
  Border-radius: 10px
  Padding: 16px
  Text centered
  Title: "+ Add Level" — 13px, weight 600, --primary
  Subtitle: 11px, --text-muted
  Hover: bg --primary-light, border-color --primary
  
Click → dropdown or popover:
  Shows available dimension types (excluding already used ones)
  Each option: icon + name + field mapping
  Selecting one → new level card appears with that dimension
  Node preview is empty → admin clicks "Manage Nodes" to populate
```

### 6.5 Drag to Reorder Levels

```
Admin bisa drag level cards untuk reorder (e.g., swap Region and Segment).

Drag behavior:
  - Grab from ⠿ handle
  - Card lifts: shadow --shadow-lg, opacity 0.95, scale 1.01
  - Drop placeholder: dashed 2px --primary, same height as card
  - Arrow connectors animate to new positions
  - On drop: tree preview updates instantly

WARNING: Reordering levels that have existing goal_nodes data:
  Show confirmation dialog:
  "Changing hierarchy order will reorganize existing goal data.
   Nodes at the affected levels may need manual re-assignment.
   This cannot be undone automatically."
  [Cancel] [Reorganize Structure]
  
  If no data exists yet: silent reorder, no confirmation needed
```

---

## 7. Live Tree Preview (Right Panel)

Real-time visualization of what the goal tree looks like with current config.

### 7.1 Layout

```
┌─ LIVE TREE PREVIEW ──────────────────────────────────┐
│                                                       │
│  📊 Company Goal                                      │
│  Rp 130.0B · Yearly 2026                             │
│  ├─── L1  WNS                                         │
│  │    ├─── L2  MICE                                    │
│  │    ├─── L2  Travel                                  │
│  │    ├─── L2  Creative                                │
│  │    ├─── L2  Retail                                  │
│  │    ├─── L2  Training                                │
│  │    └─── L2  Wellness                                │
│  ├─── L1  WNW                                         │
│  │    ├─── L2  MICE                                    │
│  │    └─── L2  ...                                     │
│  ├─── L1  Jogja                                       │
│  │    └─── L2  ...                                     │
│  ├─── L1  TEE                                         │
│  └─── L1  UK                                          │
│                                                       │
│  ──────────────────────────────────────               │
│  Depth: 2 levels                                      │
│  Total nodes: 48                                      │
│  Leaf nodes: 42                                       │
│  Coverage: 6 subsidiaries × 7 segments                │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### 7.2 Specs

```
Container:
  Background: white
  Border: 1px solid --border
  Border-radius: 10px
  Padding: 16px
  Position: sticky, top below toolbar (follows scroll)
  Max-height: calc(100vh - 200px)
  Overflow-y: auto

Root node:
  📊 icon + goal name + amount
  Font: 13px, weight 700

Tree lines:
  Vertical + horizontal connector lines
  Color: --tree-line (#d1d5db)
  Width: 1px
  Standard file-tree ASCII art style: ├──, └──, │

Node row:
  Level badge: same L1/L2/L3 style as level cards
  Name: 12px, weight 500
  Nodes with children: bold
  Leaf nodes: regular weight

Collapse: nodes collapsible by clicking, default expanded to 2 levels
  Deeper levels: collapsed with "..." indicator

Stats footer:
  Depth, total nodes, leaf nodes, coverage description
  Font: 10.5px, --text-muted
  Border-top: 1px solid --border-light
  Padding-top: 12px

Auto-update:
  When admin changes levels, adds nodes, reorders → tree re-renders
  Smooth animation: new nodes slide in, removed nodes fade out
```

---

## 8. Node Manager — Side Panel

Opened from "Manage Nodes →" link on each level card. This is where admin adds/removes/edits individual nodes for a dimension level.

### 8.1 Layout

```
┌──────────────────────────────────────────────────────────┐
│  Manage Subsidiary Nodes                            ✕    │
│  Level 1 · 6 nodes                                       │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  SOURCE                                                  │
│  ○ From master data (companies with is_holding = false)  │
│  ● Manual entry                                          │
│                                                          │
│  ALLOCATION MODE FOR THIS LEVEL                          │
│  [● Percentage]  [Absolute]                              │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  NODES                                           [+ Add] │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  ⠿  Werkudara Nirwana Sakti (WNS)      ✎    🗑   │ │
│  │     Mapped to: company_id = abc-123               │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  ⠿  Werkudara Nirwana Wisata (WNW)     ✎    🗑   │ │
│  │     Mapped to: company_id = def-456               │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  ⠿  Jogja                              ✎    🗑   │ │
│  │     Mapped to: company_id = ghi-789               │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  ⠿  TEE                                ✎    🗑   │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  ⠿  UK                                 ✎    🗑   │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  ⠿  Creative                           ✎    🗑   │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  APPLY TO ALL PARENTS?                                   │
│  ☑ Apply same nodes to all parents                      │
│    (Every L1 subsidiary gets the same L2 segments)       │
│  ☐ Customize per parent                                 │
│    (Each L1 subsidiary can have different L2 segments)   │
│                                                          │
│  ═══════════════════════════════════════════════════════  │
│  [Cancel]                              [Save Nodes]      │
└──────────────────────────────────────────────────────────┘
```

### 8.2 Source Selection

```
Two modes for populating nodes:

○ "From master data" — auto-populate from existing data
  Based on dimension type:
  - Subsidiary → SELECT name FROM companies WHERE is_holding = false
  - Segment → SELECT DISTINCT category FROM leads WHERE company_id = ...
  - Stream → SELECT DISTINCT stream_type FROM leads
  - Region → SELECT DISTINCT area FROM leads
  - Sales Person → SELECT full_name FROM profiles WHERE is_active = true
  
  Shows: checkboxes to select which items to include
  "Select All" / "Deselect All" toggle
  Search: filter items by name

● "Manual entry" — admin types names manually
  Input field + Add button
  Or: textarea for bulk add (one per line)
```

### 8.3 Node Row

```
Each node row:
  ⠿ Drag handle — reorder nodes (affects sort_order)
  Name: 12.5px, weight 500, --text-primary
  Subtitle: "Mapped to: {reference_field} = {reference_value}" — 10px, --text-muted
    Only visible if node has reference mapping
  ✎ Edit: rename, change mapping — ghost button, visible on hover
  🗑 Delete: --negative, visible on hover
    If node has data (goal_nodes with targets): show warning
    "This node has allocated targets. Deleting will remove all breakdowns below it."
    [Cancel] [Delete Anyway]
  
  Height: 44px
  Padding: 8px 14px
  Border-bottom: 1px solid --border-light
  Hover: bg --bg-subtle
  Drag: same pattern as pipeline stages (lift, shadow, placeholder)
```

### 8.4 "Apply to All Parents" Toggle

Ini penting untuk usability. Kalau admin punya 6 subsidiaries (L1) dan mau setiap subsidiary punya 7 segments yang sama (L2), mereka tidak mau set 7 segments × 6 kali.

```
☑ "Apply same nodes to all parents"
  → Saat save, system creates the same L2 nodes under every L1 parent
  → Ini default behavior — paling common use case
  → Di tree preview: semua L1 nodes punya children yang sama

☐ "Customize per parent"
  → Panel berubah: shows parent selector dropdown
  → Admin pilih parent, lalu set nodes untuk parent itu saja
  → Repeat per parent
  → Di tree preview: setiap L1 bisa punya children berbeda

Parent selector (saat customize mode):
  ┌──────────────────────────────────────┐
  │ Select parent: [WNS              ▾] │
  │                                      │
  │ Nodes for WNS:                       │
  │ ☑ MICE                              │
  │ ☑ Travel                            │
  │ ☑ Creative                          │
  │ ☐ Retail  (unchecked = not included) │
  │ ☑ Training                          │
  │ ☐ Wellness                          │
  │                                      │
  │ [Select parent: WNW ▾] to configure │
  │ next parent's nodes                  │
  └──────────────────────────────────────┘
```

### 8.5 Side Panel Specs

```
Width: 480px
Slide from right, 250ms ease-out
Backdrop: rgba(0,0,0, 0.12)
Background: white
Border-left: 1px solid --border
Shadow: --shadow-panel

Header: 
  Title: "Manage {DimensionName} Nodes" — 16px, weight 700
  Subtitle: "Level {N} · {count} nodes" — 12px, --text-secondary
  Close (✕): top right
  Padding: 20px

Body:
  Padding: 0 20px
  Overflow-y: auto
  Section dividers: 1px solid --border-light, margin 16px 0

Footer (sticky):
  Padding: 16px 20px
  Border-top: 1px solid --border
  Cancel: outlined
  Save Nodes: primary filled
```

---

## 9. Monthly Weight Distribution

Full-width card below the hierarchy builder + preview.

### 9.1 Layout

```
┌─ MONTHLY WEIGHT DISTRIBUTION ────────────────────────────────────────┐
│                                                                       │
│  How should the annual target distribute across months?               │
│                                                                       │
│  Preset: [Equal]  [Front-loaded]  [Back-loaded]  [● Custom]         │
│                                                                       │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐   │
│  │ JAN  │ FEB  │ MAR  │ APR  │ MAY  │ JUN  │ JUL  │ AUG  │ ... │   │
│  │      │      │      │      │      │      │      │      │     │   │
│  │ [2%] │ [4%] │ [5%] │[10%] │[13%] │[14%] │[15%] │ [9%] │     │   │
│  │      │      │      │      │      │      │      │      │     │   │
│  │2.6B  │5.2B  │6.5B  │13.0B │16.9B │18.2B │19.5B │11.7B │     │   │
│  │      │      │      │      │      │      │      │      │     │   │
│  │  ▁   │  ▂   │  ▃   │  ▅   │  ▆   │  ▇   │  █   │  ▅   │     │   │
│  └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘   │
│                                                                       │
│  Total: 100% ✓                                    [Reset to Equal]   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 9.2 Specs

```
Card: bg white, border 1px --border, radius 10px, padding 20px

Preset buttons (top):
  Segmented control or pill group
  - "Equal": sets all months to 8.33%
  - "Front-loaded": higher weights Jan-Jun
  - "Back-loaded": higher weights Jul-Dec
  - "Custom": manual input (default if any month ≠ preset)
  Active: bg --primary, text white
  Inactive: bg transparent, border 1px --border
  Height: 30px, border-radius: 6px
  Click preset → fills all 12 inputs automatically

Month grid:
  Display: grid, 12 columns (or 6×2 on smaller screens)
  Each month cell:
    Width: flex 1 (equal distribution)
    Min-width: 64px
    Padding: 8px
    Border: 1px solid --border-light
    Border-radius: 6px
    Background: white
    
    Month label: 9px, weight 700, uppercase, --text-muted, centered
    
    Percentage input:
      Centered, 14px, weight 600, --text-primary
      Suffix: "%" (inline, not separate element)
      Width: 100%
      Border: none (borderless inside cell)
      Focus: cell border changes to --primary
      Editable: click to edit, blur to save
    
    Computed amount:
      Below percentage, 9.5px, --text-muted
      Format: compact IDR (e.g., "2.6B", "13.0B")
      Auto-computed: total_target × percentage / 100
    
    Mini bar (visual):
      Height: proportional to weight (max 24px)
      Width: 80% of cell width, centered
      Background: --weight-bar at 60% opacity
      Border-radius: 2px top
      Sits at bottom of cell
      Hover: --weight-bar-hover

Total row:
  Below grid, full width
  "Total: 100% ✓" — 12px, weight 600, --positive
  "Total: 95% ⚠ 5% unallocated" — --warning
  "Total: 105% ❌ over 100%" — --negative
  
  [Reset to Equal] — ghost button, --text-secondary, far right
```

### 9.3 Interaction

```
- Click on percentage → edit inline
- Tab between months (left to right)
- Enter → confirm and move to next month
- Escape → cancel edit
- After any edit:
  - Total recalculates immediately
  - Mini bars re-render
  - Computed Rp amounts update
  - If total ≠ 100%, show warning
- Selecting a preset auto-fills all inputs with smooth transition
```

---

## 10. Allocation Defaults Card

```
┌─ ALLOCATION & ATTRIBUTION DEFAULTS ─────────────────────────────────┐
│                                                                       │
│  ALLOCATION MODE                                                      │
│  Default for new breakdowns:                                          │
│  [● Percentage]  [Absolute]                                          │
│  Each node group can override in the matrix.                          │
│                                                                       │
│  ─────────────────────────────────────────────                       │
│                                                                       │
│  ATTRIBUTION BASIS                                                    │
│  How revenue is attributed to time periods:                           │
│  [● Event Date]  [Closed Won Date]                                   │
│  Event Date: revenue counts in the month the event takes place.       │
│  Closed Won Date: revenue counts in the month the deal was closed.   │
│                                                                       │
│  ─────────────────────────────────────────────                       │
│                                                                       │
│  MONTHLY CUTOFF                                                       │
│  Day of month for period cutoff: [25]                                │
│  Revenue after day 25 rolls into the next month.                      │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

Specs:
  Card: bg white, border 1px --border, radius 10px, padding 20px
  
  Segmented controls: same style as monthly weight presets
  Description text: 11px, --text-muted, max-width 400px
  Cutoff input: number input, 48px wide, centered
```

---

## 11. Empty States

### No goal exists:

```
Full page empty state (replaces all sections):

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │              🎯                                      │
  │                                                      │
  │    No revenue goal configured                        │
  │                                                      │
  │    Set up your annual target to start breaking       │
  │    down revenue goals across your organization.       │
  │                                                      │
  │    [+ Create Annual Goal]                            │
  │                                                      │
  └──────────────────────────────────────────────────────┘

Click CTA → modal:
  Goal Name: [e.g., "2026 Annual Target"]
  Period Type: [Yearly ▾]
  Year: [2026 ▾]
  Total Target: [Rp ___________]
  [Cancel] [Create Goal]
```

### Goal exists but no levels:

```
Goal Overview card renders normally.
Hierarchy Builder shows:

  ┌──────────────────────────────────────────────┐
  │                                              │
  │  No breakdown levels defined yet.            │
  │                                              │
  │  Add your first level to start building      │
  │  the revenue target hierarchy.               │
  │                                              │
  │  Popular starting points:                    │
  │  [Subsidiary]  [Stream]  [Region]            │
  │                                              │
  │  Or: [+ Custom Level]                        │
  │                                              │
  └──────────────────────────────────────────────┘

"Popular starting points" = quick-add buttons for common dimensions.
Click one → immediately creates level with that dimension type.
```

---

## 12. Responsive Behavior

```
Desktop (≥1280px):
  2-column: Hierarchy Builder (60%) + Tree Preview (40%)
  Monthly weights: 12 columns in 1 row
  Side panel: 480px

Tablet (768-1279px):
  Stack: Hierarchy Builder full width, Tree Preview below it
  Monthly weights: 6 columns × 2 rows
  Side panel: 420px

Mobile (≤767px):
  Everything stacked single column
  Monthly weights: 4 columns × 3 rows
  Side panel: full width (bottom sheet)
  Tree preview: collapsible accordion
```

---

## 13. File Structure

```
src/
├── app/settings/goals/page.tsx             # Goal Settings page
├── features/goals/components/
│   ├── goal-settings-page.tsx              # Page orchestrator
│   ├── goal-overview-card.tsx              # Top card (name, target, period)
│   ├── goal-hierarchy-builder.tsx          # Left panel — level cards
│   ├── goal-level-card.tsx                 # Individual level card
│   ├── goal-tree-preview.tsx              # Right panel — live tree
│   ├── goal-node-manager-panel.tsx        # Side panel for managing nodes
│   ├── goal-node-row.tsx                  # Single node row in panel
│   ├── goal-node-source-picker.tsx        # Master data vs manual toggle
│   ├── goal-monthly-weights.tsx           # Monthly weight distribution card
│   ├── goal-monthly-cell.tsx             # Individual month cell (input + bar)
│   ├── goal-allocation-defaults.tsx       # Allocation + attribution config
│   └── goal-create-modal.tsx             # Create new goal modal
```

---

## 14. Checklist

### Page Structure:
- [ ] Sticky header (64px, "Goal Configuration" title + "View Matrix" button)
- [ ] Goal Overview card (name, target, period, status, edit)
- [ ] 2-column layout: Hierarchy Builder (60%) + Tree Preview (40%)
- [ ] Monthly Weight Distribution card (full width)
- [ ] Allocation Defaults card (full width)

### Hierarchy Builder:
- [ ] Level cards with: drag handle, level badge, dimension dropdown, node count, chip preview
- [ ] Arrow connectors between level cards
- [ ] Drag to reorder levels (with confirmation if data exists)
- [ ] "+ Add Level" with dimension picker (excludes already-used dimensions)
- [ ] Delete level (with data warning)
- [ ] "Manage Nodes →" opens side panel

### Tree Preview:
- [ ] Live-updating tree visualization
- [ ] Indented tree with connector lines
- [ ] Level badges per node
- [ ] Collapsible nodes (default: expand 2 levels)
- [ ] Stats footer (depth, node count, leaf count)
- [ ] Sticky position (follows scroll)

### Node Manager Panel:
- [ ] Source toggle: master data vs manual entry
- [ ] Master data: auto-populate from companies/leads/profiles with checkboxes
- [ ] Manual entry: text input + add button
- [ ] Node list: drag to reorder, edit name, delete
- [ ] "Apply to all parents" vs "Customize per parent" toggle
- [ ] Allocation mode selector per level
- [ ] Save creates/updates goal_nodes in database

### Monthly Weights:
- [ ] 12-cell grid with percentage inputs
- [ ] Auto-computed Rp amounts below each percentage
- [ ] Mini bar chart visual per cell
- [ ] Presets: Equal, Front-loaded, Back-loaded, Custom
- [ ] Total validation (100% target, warnings if not)
- [ ] Tab navigation between cells

### Allocation Defaults:
- [ ] Allocation mode toggle (Percentage / Absolute)
- [ ] Attribution basis toggle (Event Date / Closed Won Date)
- [ ] Monthly cutoff day input

### Empty States:
- [ ] No goal: full-page CTA to create
- [ ] No levels: inline CTA with popular starting points
- [ ] No nodes: message in level card

### Integration:
- [ ] "⚙ Manage Goal Configuration" from /goals → navigates here
- [ ] "📊 View Matrix" from here → navigates to /goals
- [ ] Changes auto-save (or explicit Save button at bottom)
- [ ] Tree preview updates in real-time on every change
