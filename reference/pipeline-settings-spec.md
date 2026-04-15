> Partial-reference note: this file captures pipeline UI intent and should not be treated as the canonical implemented system document.
> Use [docs/leadengine-system-overview.md](D:\Website\Group Lead 2026\docs\leadengine-system-overview.md) for current system truth.

# Pipeline Settings — UI/UX Redesign Specification v2

> **Prompt untuk IDE agent — Pipeline Settings dengan overview semua pipeline di satu halaman + drill-down ke detail rules.**

---

## 1. Navigation Flow

```
Settings
  └─ Pipeline Configuration (LEVEL 1 — Overview)
       │
       │  Semua pipeline tampil di satu halaman
       │  Setiap pipeline card menampilkan stages-nya
       │  Admin bisa reorder stages, add/remove, set default
       │
       └─ {Pipeline Name} Settings (LEVEL 2 — Detail)
            │
            ├─ Transition Rules
            └─ Closure Restrictions
```

**User flow:**
1. Admin masuk ke Pipeline Configuration → lihat semua pipeline sekaligus
2. Klik "Configure Rules" atau klik pipeline header → masuk detail pipeline
3. Di detail: manage transition rules & closure restrictions
4. Klik "← Back to Pipeline Configuration" → kembali ke overview

---

## 2. Design Tokens

```css
/* Consistent with dashboard design system */
--bg-page:         #f2f3f6;
--bg-card:         #ffffff;
--text-primary:    #0f1729;
--text-secondary:  #8892a4;
--text-muted:      #94a3b8;
--border:          #e5e8ed;
--border-light:    #f1f3f5;
--primary:         #6366f1;
--primary-light:   #eef2ff;
--primary-dark:    #4f46e5;
--positive:        #10b981;
--negative:        #ef4444;
--warning:         #f59e0b;

/* Stage preset colors */
--stage-blue:      #6366f1;
--stage-violet:    #8b5cf6;
--stage-sky:       #0ea5e9;
--stage-emerald:   #10b981;
--stage-amber:     #f59e0b;
--stage-red:       #ef4444;
--stage-pink:      #ec4899;
--stage-orange:    #f97316;
--stage-teal:      #14b8a6;
--stage-slate:     #64748b;

/* Spacing */
card-padding:      16px;
card-radius:       10px;
gap:               12px;

/* Typography */
page-title:        19px, weight 800
card-title:        14px, weight 700
body:              12.5px, weight 400-500
label:             10px, weight 600, uppercase, letter-spacing 0.8px
```

---

## 3. LEVEL 1 — Pipeline Configuration (Overview)

### 3.1 Page Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back to Settings                                                     │
│                                                                          │
│  Pipeline Configuration                                                 │
│  Manage your sales pipelines, stages, and rules                         │
│                                                       [ + New Pipeline ] │
│                                                                          │
│  ┌─ Pipeline 1 ─────────┐  ┌─ Pipeline 2 ─────────┐  ┌─ + New ───────┐│
│  │  ★ Sales Pipeline     │  │  Procurement Pipeline │  │               ││
│  │  DEFAULT              │  │                       │  │   + Create    ││
│  │                       │  │                       │  │   New         ││
│  │  OPEN STAGES          │  │  OPEN STAGES          │  │   Pipeline   ││
│  │  ● Lead               │  │  ● Vendor Search      │  │               ││
│  │  ● Qualified          │  │  ● Evaluation         │  │               ││
│  │  ● Proposal Sent      │  │  ● Negotiation        │  │               ││
│  │                       │  │  ● Approval            │  │               ││
│  │  CLOSED STAGES        │  │                       │  │               ││
│  │  ✓ Closed Won         │  │  CLOSED STAGES        │  │               ││
│  │  ✕ Closed Lost        │  │  ✓ Closed Won         │  │               ││
│  │                       │  │  ✕ Closed Lost        │  │               ││
│  │  ─────────────────    │  │                       │  │               ││
│  │  3 rules · 1 restrict │  │  ─────────────────    │  │               ││
│  │  [ Configure Rules ]  │  │  No rules yet         │  │               ││
│  │                       │  │  [ Configure Rules ]  │  │               ││
│  └───────────────────────┘  └───────────────────────┘  └───────────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Page Header

```
← Back to Settings
- Font: 12px, weight 500, color --text-secondary
- Hover: color --primary
- Margin-bottom: 16px

Title: "Pipeline Configuration"
- Font: 19px, weight 800, color --text-primary
- Letter-spacing: -0.3px

Subtitle: "Manage your sales pipelines, stages, and rules"
- Font: 12px, color --text-secondary
- Margin-top: 2px

"+ New Pipeline" button:
- Position: top right, aligned with title
- Style: outlined, --primary border + text, weight 600
- Padding: 8px 16px, radius 8px
- Hover: bg --primary-light
```

### 3.3 Pipeline Cards Grid

```
Layout: CSS Grid
grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))
gap: 12px
max-columns: 4 (pada screen besar)

Setiap card = 1 pipeline
Card terakhir = "+ Create New Pipeline" placeholder card
```

### 3.4 Pipeline Card — Anatomy

```
┌─────────────────────────────────────────────────┐
│                                                  │  ← Header area
│  ★ Sales Pipeline                    ⋮ menu     │
│  DEFAULT · 5 stages · 3 rules                   │
│                                                  │
├─────────────────────────────────────────────────┤
│                                                  │  ← Flow preview
│  ○──→○──→○──→●✓ / ●✕                            │
│  (mini horizontal flow, compact)                 │
│                                                  │
├─────────────────────────────────────────────────┤
│                                                  │  ← Open stages
│  OPEN STAGES                                     │
│                                                  │
│  ⠿ ● Lead                                       │
│  ⠿ ● Qualified                                  │
│  ⠿ ● Proposal Sent                              │
│                                                  │
│  + Add Stage                                     │
│                                                  │
├─────────────────────────────────────────────────┤
│                                                  │  ← Closed stages
│  CLOSED STAGES                                   │
│                                                  │
│  ⠿ ✓ Closed Won                                 │
│  ⠿ ✕ Closed Lost                                │
│                                                  │
│  + Add Stage                                     │
│                                                  │
├─────────────────────────────────────────────────┤
│                                                  │  ← Footer
│  3 rules · 1 restriction                        │
│  [ Configure Rules → ]                           │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Card specs:**
```
Background: white
Border: 1px solid --border
Border-radius: 12px
Box-shadow: 0 1px 3px rgba(0,0,0,.03)
Overflow: hidden
Min-height: fit content
```

**Default pipeline indicator:**
```
- Star icon (★) sebelum nama pipeline, color #f59e0b (amber)
- "DEFAULT" text badge setelah nama atau di bawah nama
  - Font: 9px, weight 700, uppercase, letter-spacing 1px
  - Color: #f59e0b
  - Background: #fef3c7 (amber-50)
  - Padding: 1px 6px, radius 3px
- Default pipeline card punya border-top 3px solid #f59e0b
- Non-default pipeline: no star, no badge, no border-top
```

**Card header:**
```
Padding: 14px 14px 10px
Border-bottom: none (integrated)

Pipeline name: 14px, weight 700, color --text-primary
Subtitle: "5 stages · 3 rules" — 10.5px, --text-secondary
Three-dot menu (⋮): 
  - Rename Pipeline
  - Set as Default Pipeline  (disabled if already default)
  - Duplicate Pipeline
  - Delete Pipeline  (disabled if only 1 pipeline, or if default)
```

**Mini flow preview:**
```
Padding: 8px 14px
Background: #fafbfc (very subtle)

- Horizontal chain of stage dots
- Open stages: hollow circles (○) 8px, stroke with stage color
- Closed Won: filled circle (●) 8px, green, checkmark
- Closed Lost: filled circle (●) 8px, red, cross
- Arrows: → connecting dots, 1px solid #d1d5db
- Compact: all on one line, overflow hidden if too many stages
- Max visible: 6 dots, then "+2 more" text
- This preview updates live when stages are reordered/added/removed
```

**Stage list — Open Stages:**
```
Section label: "OPEN STAGES"
- Font: 9.5px, weight 700, uppercase, letter-spacing 1px
- Color: --text-muted
- Padding: 12px 14px 4px

Stage row:
- Padding: 6px 14px
- Display: flex, align-items center
- Drag handle (⠿): 12px, color #c0c7d2, cursor grab, opacity 0.5 → 1 on hover
- Stage color dot (●): 8px circle, margin-right 8px
- Stage name: 12.5px, weight 500, color --text-primary
- Hover: background #fafbfc, stage menu (⋮) appears
  - Menu: Rename, Change Color, Delete
- Drag-to-reorder within same section only

"+ Add Stage" button:
- Font: 11.5px, weight 500, color --primary
- Padding: 8px 14px
- Hover: bg --primary-light
- Border-top: 1px solid --border-light (visual separator)
```

**Stage list — Closed Stages:**
```
Same specs as open stages except:
- Section label: "CLOSED STAGES"
- Icon sebelum nama: ✓ (won, green) atau ✕ (lost, red) — bukan color dot
- Biasanya 2 stages (Won + Lost) tapi bisa ditambah
- Saat add closed stage: prompt pilih outcome (Won / Lost / Other)
```

**Card footer:**
```
Padding: 10px 14px
Border-top: 1px solid --border-light
Background: #fafbfc

Rules summary: "3 rules · 1 restriction" atau "No rules yet"
- Font: 10.5px, --text-secondary
- Kalau "No rules": show in italic, muted

"Configure Rules →" button:
- Font: 11.5px, weight 600, color --primary
- Hover: underline
- Click → navigates to LEVEL 2 detail page
- Arrow (→) indicates navigation away
```

### 3.5 "+ Create New Pipeline" Placeholder Card

```
┌─────────────────────────────────────────────────┐
│                                                  │
│                                                  │
│              ┌──────────┐                        │
│              │    +     │                        │
│              └──────────┘                        │
│                                                  │
│          Create New Pipeline                     │
│                                                  │
│     Define a custom pipeline for                 │
│     different business processes                 │
│                                                  │
│                                                  │
└─────────────────────────────────────────────────┘

Specs:
- Border: 2px dashed #d1d5db
- Background: transparent (no fill)
- Border-radius: 12px
- Cursor: pointer
- Hover: border-color --primary, bg --primary-light (very subtle)
- Icon: + inside circle, 40px, --text-muted
- Title: "Create New Pipeline" — 13px, weight 600, --text-secondary
- Subtitle: description — 11px, --text-muted
- All centered vertically and horizontally
- Min-height matches tallest pipeline card (via CSS grid)
```

### 3.6 Set as Default — Interaction

Saat user klik "Set as Default Pipeline" dari three-dot menu:

```
1. Confirmation: 
   "Set Sales Pipeline as default? This will be shown first 
    in Pipeline view and Dashboard."
   [Cancel] [Set as Default]

2. On confirm:
   - Previous default loses star + badge + border-top
   - New default gains star + badge + border-top with amber
   - Smooth transition animation (300ms)
   - Toast: "Sales Pipeline is now the default"

3. Visual:
   - Star icon animates in (scale 0 → 1, rotate)
   - DEFAULT badge slides in
   - Border-top color transitions
```

### 3.7 Inline Stage Editing

**Double-click stage name → inline edit:**
```
- Text becomes editable input
- Auto-focus, select all text
- Border: none, bottom-border 1.5px solid --primary
- Background: #fafbfc
- Enter = save
- Escape = cancel
- Click outside = save
- Validation: not empty, not duplicate within same pipeline
- On save: mini flow preview updates instantly
```

**Drag & drop stages:**
```
- Only within same section (open ↔ open, closed ↔ closed)
- Drag state: card lifts, shadow increases, opacity 0.92
- Drop placeholder: 2px dashed --primary border, same height
- Animation: 200ms ease
- On drop: mini flow preview updates instantly
```

**Color picker (from stage menu → Change Color):**
```
- Popover, appears near the stage row
- 10 preset colors in 2×5 grid
- Circle swatches: 22px
- Active: ring 2px --primary, scale 1.1
- Click = immediate change, no confirm needed
- Popover closes on selection or click outside
```

---

## 4. LEVEL 2 — Pipeline Detail (Rules & Restrictions)

### 4.1 Navigation

```
User clicks "Configure Rules →" on a pipeline card
→ Page transitions to detail view (slide-in from right, or route change)
→ URL: /settings/pipeline/{pipeline-id}
```

### 4.2 Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Pipeline Configuration                               │
│                                                                  │
│  ★ Sales Pipeline                                                │
│  5 stages · DEFAULT                                              │
│                                                                  │
│  ┌─── Pipeline Flow Preview (read-only) ────────────────────┐   │
│  │  ○ Lead → ○ Qualified → ○ Proposal → ● Won / ● Lost     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────┬───────────────────────┐                 │
│  │  Transition Rules  │  Closure Restrictions  │                 │
│  └────────────────────┴───────────────────────┘                 │
│                                                                  │
│  ┌─── Tab Content ──────────────────────────────────────────┐   │
│  │                                                           │   │
│  │  (Transition Rules or Closure Restrictions)               │   │
│  │                                                           │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Header:**
```
Back link: "← Back to Pipeline Configuration"
- Returns to Level 1 overview page
- Font: 12px, weight 500, color --text-secondary

Pipeline name: 17px, weight 800
Subtitle: "5 stages · DEFAULT" (or just "5 stages" if not default)
Default badge same style as Level 1

Flow preview: read-only version of the mini flow, larger (node 12px)
- Shows complete pipeline flow for context
- NOT editable here — editing is on Level 1
```

**Tab bar: 2 tabs only**
```
- Transition Rules
- Closure Restrictions
- Active: bottom border 2px --primary, text --primary, weight 600
- Inactive: text --text-secondary
```

### 4.3 Transition Rules Tab

**Layout — Rules list:**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                    [ + New Rule]│
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  ● Any Stage  ────→  ✓ Closed Won                        │  │
│  │                                                           │  │
│  │  Required:                                                │  │
│  │  ┌──────────┐ ┌──────────────┐ ┌──────────┐              │  │
│  │  │ Revenue  │ │ Closing Date │ │ Contract │              │  │
│  │  └──────────┘ └──────────────┘ └──────────┘              │  │
│  │  + Note required  + File required                        │  │
│  │                                                           │  │
│  │  Checklist: 3 items                       [ Edit ] [ ✕ ] │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  ● Proposal Sent  ────→  ✕ Closed Lost                   │  │
│  │                                                           │  │
│  │  Required:                                                │  │
│  │  ┌─────────────┐                                          │  │
│  │  │ Lost Reason │                                          │  │
│  │  └─────────────┘                                          │  │
│  │  + Note required                                          │  │
│  │                                                           │  │
│  │                                         [ Edit ] [ ✕ ]   │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Rule card specs:**
```
Card: bg white, border 1px --border, radius 10px, padding 16px
Hover: border-color --primary + "20"

Stage transition header:
- From stage: color dot (8px) + name (12.5px, weight 600)
- Arrow: "────→" line with arrowhead, color #c0c7d2
- To stage: icon (✓/✕ for closed, ● for open) + name
- "Any Stage": grey dot, italic text
- Layout: horizontal, centered vertically

Required fields:
- Label "Required:" — 10px, weight 600, --text-muted, uppercase
- Field chips: bg --primary-light, color --primary, 10.5px, weight 500
  - Padding: 2px 8px, radius 4px, gap 4px
- Additional requirements: "+ Note required", "+ File required"
  - Font: 10.5px, --text-secondary
  - Prefix "+": weight 600
- Checklist summary: "Checklist: 3 items" — 10.5px, --text-secondary

Action buttons (right-aligned, bottom):
- Edit: text button, --primary, 11px, weight 600
- Delete (✕): text button, --negative, 11px — visible on hover only
```

**"+ New Rule" button:**
```
Position: top right of tab content area
Style: --primary bg, white text, weight 600
Padding: 8px 16px, radius 8px
Icon: + before text
Hover: --primary-dark bg
Click → opens side panel
```

**Empty state:**
```
Centered in tab content area
Icon: decorative illustration or simple icon (rule/flow symbol)
Title: "No transition rules yet" — 14px, weight 600, --text-primary
Subtitle: "Rules ensure data quality by requiring specific information
           when leads move between pipeline stages." — 12px, --text-secondary
CTA: "[ + Create your first rule ]" — --primary, weight 600
```

### 4.4 Create / Edit Rule — Side Panel

Slide-in dari kanan, 480px width.

```
┌──────────────────────────────────────────────────┐
│  Create Transition Rule                     ✕    │
│  ────────────────────────────────────────────    │
│                                                   │
│  When a lead moves between these stages,          │
│  users must provide the following information.     │
│                                                   │
│  ─────────────────────────────────────────────    │
│                                                   │
│  STAGE TRANSITION                                 │
│                                                   │
│  From Stage                                       │
│  ┌─────────────────────────────────────┐         │
│  │ ◌ Any Stage                       ▾ │         │
│  └─────────────────────────────────────┘         │
│                                                   │
│              ↓                                    │
│                                                   │
│  To Stage                                         │
│  ┌─────────────────────────────────────┐         │
│  │ Choose a stage                    ▾ │         │
│  └─────────────────────────────────────┘         │
│                                                   │
│  ─────────────────────────────────────────────    │
│                                                   │
│  MANDATORY INFORMATION                            │
│                                                   │
│  ☑ Fields                                         │
│     ┌───────────────────────────────────┐        │
│     │ Search fields...               ▾ │        │
│     └───────────────────────────────────┘        │
│     ┌──────────┐ ┌──────────┐ ┌────────┐        │
│     │Revenue ✕ │ │ Date  ✕  │ │PIC  ✕  │        │
│     └──────────┘ └──────────┘ └────────┘        │
│                                                   │
│  ☐ Note                                          │
│     Require a note when transitioning             │
│                                                   │
│  ☐ File Attachment                                │
│     Require a file upload                         │
│                                                   │
│  ─────────────────────────────────────────────    │
│                                                   │
│  CHECKLIST                                        │
│                                                   │
│  ☑ Enable checklist                               │
│     ┌───────────────────────────────────┐        │
│     │ ⠿ ☐ Verify client information    │        │
│     │ ⠿ ☐ Confirm pricing with finance │        │
│     │ ⠿ ☐ Get manager approval         │        │
│     │                                   │        │
│     │ + Add item                        │        │
│     └───────────────────────────────────┘        │
│                                                   │
│  ═══════════════════════════════════════════════  │
│  ┌──────────┐  ┌─────────────────────┐           │
│  │  Cancel   │  │  Save Rule          │           │
│  └──────────┘  └─────────────────────┘           │
└──────────────────────────────────────────────────┘
```

**Side panel specs:**
```
Width: 480px
Background: white
Border-left: 1px solid --border
Box-shadow: -8px 0 30px rgba(0,0,0,.08)
Animation: translateX(100%) → translateX(0), 250ms ease-out
Backdrop: rgba(0,0,0,.12), click to close
Z-index: 50

Header:
- Title: 16px, weight 700, --text-primary
- Close ✕: 20px, --text-muted, hover --text-primary
- Padding: 20px
- Border-bottom: 1px solid --border-light

Body:
- Padding: 20px
- Overflow-y: auto
- Section dividers: 1px solid --border-light, margin 16px 0
- Section labels: 10px, weight 700, uppercase, letter-spacing 0.8px, --text-muted

Footer (sticky):
- Padding: 16px 20px
- Border-top: 1px solid --border
- Background: white
- Cancel: outlined, --text-secondary border + text
- Save Rule: filled, --primary bg, white text, weight 600
- Both: padding 9px 20px, radius 8px
```

**Stage dropdowns:**
```
- Custom dropdown (not native select)
- Each option shows: ● color dot + stage name
- "Any Stage" option: ◌ grey hollow dot + "Any Stage" (italic)
- Divider between open stages and closed stages
- Selected state: shows dot + name in dropdown trigger
- Arrow (↓) between From and To:
  - Centered, dashed line 20px, color --border
  - Arrow icon at bottom

Validation:
- From ≠ To (cannot be same stage)
- Duplicate check: if From+To combo already has a rule → inline error
  "A rule already exists for this transition"
  - Save button disabled
```

**Field selector:**
```
- Multi-select with search
- Dropdown opens below, max-height 200px, scrollable
- Each field option: icon (based on type) + field name
  - Text fields: Aa icon
  - Number fields: # icon
  - Date fields: 📅 icon
  - Dropdown fields: ▾ icon
  - File fields: 📎 icon
- Selected fields appear as chips below dropdown
- Chip: bg #eef2ff, color #4338ca, 10.5px, weight 500
  - ✕ button to remove, hover darkens
  - Radius 5px, padding 2px 8px
```

**Checklist builder:**
```
- Toggle "Enable checklist" to show/hide
- List of items:
  - Drag handle (⠿) + checkbox (display-only) + text input
  - Text input: borderless, 12px, full width
  - Focus: bottom border 1.5px --primary
  - Delete (✕): visible on hover, right side
  - Drag to reorder
- "+ Add item": --primary text, 11px, weight 500
- Max 20 items
- Min 1 item if checklist is enabled
```

### 4.5 Closure Restrictions Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  Closure Restrictions                                            │
│  Control which stages can directly transition to closed states   │
│                                                                  │
│  ┌──── Closed Won ──────────────────────────────────────────┐   │
│  │                                                           │   │
│  │  ✓ Closed Won — can be reached from:                      │   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────┐     │   │
│  │  │  ☐ Lead            → Currently: blocked         │     │   │
│  │  │  ☑ Qualified       → Currently: allowed         │     │   │
│  │  │  ☑ Proposal Sent   → Currently: allowed         │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  │                                                           │   │
│  │  Summary: Can close as Won from Qualified, Proposal Sent  │   │
│  │                                                           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──── Closed Lost ─────────────────────────────────────────┐   │
│  │                                                           │   │
│  │  ✕ Closed Lost — can be reached from:                     │   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────┐     │   │
│  │  │  ☑ Lead            → Currently: allowed         │     │   │
│  │  │  ☑ Qualified       → Currently: allowed         │     │   │
│  │  │  ☑ Proposal Sent   → Currently: allowed         │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  │                                                           │   │
│  │  Summary: All stages can close as Lost                    │   │
│  │                                                           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────┐                                    │
│  │  Save Restrictions       │                                    │
│  └─────────────────────────┘                                    │
│                                                                  │
│  💡 Restricting early-stage closures ensures leads progress      │
│     through proper qualification before closing.                 │
└─────────────────────────────────────────────────────────────────┘
```

**Restriction card:**
```
Card: bg white, border 1px --border, radius 10px, padding 16px

Header:
- Closed Won: "✓ Closed Won" — icon green, text 13px weight 700
- Closed Lost: "✕ Closed Lost" — icon red, text 13px weight 700
- Subtitle "can be reached from:" — 11px, --text-secondary

Checkbox list:
- Each open stage: checkbox + color dot + stage name
  - Checked = allowed (transition permitted)
  - Unchecked = blocked (transition restricted)
  - Checkbox: custom, --primary when checked
  - Label: 12px, weight 500
  - Status text: "→ Currently: allowed/blocked"
    - Allowed: --positive color
    - Blocked: --text-muted, stage name gets opacity 0.5
  - Gap: 6px

Summary:
- Auto-generated text, 10.5px, --text-secondary
- Updates real-time on check/uncheck
- Examples:
  - "All stages can close as Won"
  - "Can close as Won from Qualified, Proposal Sent"
  - "No stages can close as Won" (+ warning icon ⚠)
```

**Save button:**
```
- Enabled only when changes are made (dirty state detection)
- Style: --primary bg, white text, weight 600
- Disabled: opacity 0.5, cursor not-allowed
- Loading: "Saving..." with spinner
- Success: "Saved ✓" (green flash) → back to "Save"
```

---

## 5. Transition Enforcement Modal (Pipeline Page)

Ketika user di halaman Pipeline mencoba pindahkan lead dan ada rule:

```
┌─────────────────────────────────────────────────┐
│  Complete Transition                        ✕   │
│  ────────────────────────────────────────────   │
│                                                  │
│  ● Proposal Sent  ───→  ✓ Closed Won            │
│  (visual with colors and arrow)                  │
│                                                  │
│  ─────────────────────────────────────────────   │
│                                                  │
│  REQUIRED FIELDS                                 │
│                                                  │
│  Revenue Amount *                                │
│  ┌────────────────────────────────────┐         │
│  │ Rp                                 │         │
│  └────────────────────────────────────┘         │
│                                                  │
│  Closing Date *                                  │
│  ┌────────────────────────────────────┐         │
│  │ dd/mm/yyyy                    📅   │         │
│  └────────────────────────────────────┘         │
│                                                  │
│  ATTACHMENT *                                    │
│  ┌─ Drop file here or click to browse ──────┐  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  NOTE *                                          │
│  ┌────────────────────────────────────┐         │
│  │                                    │         │
│  └────────────────────────────────────┘         │
│                                                  │
│  CHECKLIST                                       │
│  ☐ Verify client information                     │
│  ☐ Confirm pricing with finance                  │
│  ☐ Get manager approval                          │
│                                                  │
│  ─────────────────────────────────────────────   │
│  ┌──────────┐  ┌───────────────────────┐        │
│  │  Cancel   │  │  Confirm Transition   │        │
│  └──────────┘  └───────────────────────┘        │
└─────────────────────────────────────────────────┘

"Confirm Transition" DISABLED sampai:
- Semua required fields terisi
- File uploaded (jika required)
- Note tidak kosong (jika required)
- Semua checklist items di-check
```

---

## 6. Data Model

```typescript
interface Pipeline {
  id: string;
  name: string;
  icon?: string;
  isDefault: boolean;
  stages: Stage[];
  transitionRules: TransitionRule[];
  closureRestrictions: ClosureRestriction[];
  createdAt: string;
  updatedAt: string;
}

interface Stage {
  id: string;
  name: string;
  color: string;
  type: "open" | "closed";
  outcome?: "won" | "lost";
  order: number;
}

interface TransitionRule {
  id: string;
  fromStageId: string | "any";
  toStageId: string;
  mandatoryFields: string[];
  requireNote: boolean;
  requireFile: boolean;
  checklist: ChecklistItem[];
}

interface ChecklistItem {
  id: string;
  label: string;
  order: number;
}

interface ClosureRestriction {
  closedStageId: string;
  allowedFromStageIds: string[];
}
```

---

## 7. Checklist

### Level 1 — Overview:
- [ ] All pipelines visible in one grid layout
- [ ] Default pipeline highlighted (star, badge, border-top)
- [ ] Each card shows: stages list + mini flow + rules summary
- [ ] Drag & drop reorder stages within cards
- [ ] Inline rename stages (double-click)
- [ ] Color picker for stages
- [ ] Add/remove stages
- [ ] "Set as Default" from three-dot menu
- [ ] "Configure Rules →" navigates to Level 2
- [ ] "+ Create New Pipeline" placeholder card
- [ ] Mini flow preview auto-updates on changes

### Level 2 — Detail:
- [ ] Back link to Level 1
- [ ] Pipeline name + flow preview (read-only)
- [ ] Transition Rules tab with rule cards
- [ ] Side panel for create/edit rule (480px, slide from right)
- [ ] From/To stage selector with "Any Stage" option
- [ ] Multi-select field picker with search + chips
- [ ] Note/File requirement toggles
- [ ] Checklist builder (add, remove, reorder items)
- [ ] Duplicate rule prevention
- [ ] Closure Restrictions tab with checkbox lists
- [ ] Auto-generated summary per restriction
- [ ] Save with dirty state detection

### Transition Enforcement (Pipeline page):
- [ ] Modal triggered on stage move when rule exists
- [ ] Dynamic form based on rule configuration
- [ ] Field validation (required, format)
- [ ] File upload with drag-drop zone
- [ ] Checklist completion requirement
- [ ] "Confirm" disabled until all requirements met

### General:
- [ ] Full English, consistent terminology
- [ ] Matches dashboard design system tokens
- [ ] Responsive: tablet stacks cards, mobile full width
- [ ] Smooth animations (drag, panel, tab switch)
- [ ] Toast notifications on save
