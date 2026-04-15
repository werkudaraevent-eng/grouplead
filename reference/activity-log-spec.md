> Proposal status: this document describes a planned feature and is not implemented as a live system surface yet.
> There is no canonical `/activity` route or `activity_logs` table in the repo at this time.
> Use [docs/leadengine-system-overview.md](D:\Website\Group Lead 2026\docs\leadengine-system-overview.md) for current system truth.

# Activity History — UI/UX Specification

> **Prompt untuk IDE agent — build Activity History page yang modern, profesional, dan data-rich dengan sticky header, advanced filtering, dan user activity summary.**

---

## 1. Page Overview

URL: `/activity`
Nav: Tambahkan "Activity" di sidebar menu, di bawah "Contacts" dan di atas "ADMINISTRATION" section.
Icon: Clock atau History icon.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STICKY HEADER                                                          │
│  Activity History                                              Export ↓ │
│  Track all changes across your platform                                 │
│                                                                          │
│  [Search...🔍]  [Module ▾]  [Date Range ▾]  [User ▾]  [Clear Filters] │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─ TEAM ACTIVITY SUMMARY (collapsible) ────────────────────────────┐  │
│  │                                                                   │  │
│  │  Ahmad R. ██████████ 42   Budi S. ████████ 35   Citra D. ██ 8   │  │
│  │  Dina P.  ████ 15         Eko W.  █ 3            Fani H.  — 0   │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  TODAY                                                                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  🟣 14:32  Ahmad R.  updated lead  "Telkom Conference 2026"      │  │
│  │            LEADS   Changed: Stage Qualified → Proposal Sent       │  │
│  │                                                          ▸ Detail │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │  🟢 14:15  Budi S.  created lead  "Mandiri Gala Dinner"         │  │
│  │            LEADS   Revenue: Rp 1.2B · PIC: Budi S.              │  │
│  │                                                          ▸ Detail │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │  🔵 13:48  Admin  updated pipeline  "Sales Pipeline"             │  │
│  │            SETTINGS   Added stage: "Negotiation"                  │  │
│  │                                                          ▸ Detail │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  YESTERDAY                                                               │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  ... more activities ...                                          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ── Load more ──                                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Design Tokens

Referensi: `design-system.md` untuk semua base tokens. Tokens tambahan khusus halaman ini:

```css
/* Module badge colors */
--module-leads:      #6366f1;     /* Indigo */
--module-companies:  #0ea5e9;     /* Sky */
--module-contacts:   #8b5cf6;     /* Violet */
--module-settings:   #64748b;     /* Slate */

/* Action colors (for timeline dot) */
--action-created:    #10b981;     /* Green */
--action-updated:    #6366f1;     /* Indigo */
--action-deleted:    #ef4444;     /* Red */
--action-moved:      #f59e0b;     /* Amber — stage changes */
--action-assigned:   #0ea5e9;     /* Sky */

/* Timeline */
--timeline-line:     #e5e8ed;
--timeline-dot:      12px diameter
```

---

## 3. Sticky Header

Menggunakan pola yang sama dari dashboard (lihat `design-system.md` — Section 7.14) dengan penyesuaian:

```
Height: 128px (default) → 80px (scrolled)
Position: sticky, top 0, z-index 20

DEFAULT STATE (scroll = 0):
├── Row 1: Title "Activity History" (19px, 800) + Export button (right)
├── Row 2: Subtitle "Track all changes across your platform" (11.5px)
├── Row 3: Filter bar (search + module + date + user + clear)
└── Padding: 20px 24px 12px

SCROLLED STATE (scrollTop > 20):
├── Row 1: Title shrinks (15px) + Export button
├── Row 2: Subtitle collapses (opacity 0, position absolute)
├── Row 3: Filter bar remains fully visible (NEVER collapse filters)
└── Padding: 10px 24px
├── Background: rgba(242,243,246, 0.88)
├── Backdrop-filter: blur(14px)
├── Border-bottom: 1px solid #dfe2e7

HYSTERESIS: hide subtitle at >20px, show at <6px
CRITICAL: Header height transition MUST NOT cause layout shift.
Filter bar ALWAYS visible — this is the most important element.
```

---

## 4. Filter Bar

### 4.1 Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔍 Search activities...    [Module ▾]  [Date Range ▾]  [User ▾]  ✕ │
└──────────────────────────────────────────────────────────────────────┘

Display: flex, gap 8px, align-items center
Width: 100%
Wrap: on smaller screens, filters wrap to second line
```

### 4.2 Search Field

```
Width: flex 1 (fills remaining space, min-width 200px)
Height: 36px
Placeholder: "Search activities..."
Icon: 🔍 (search) left side, inside input
Border: 1px solid --border
Border-radius: 8px
Padding: 0 12px 0 36px (account for icon)
Focus: border-color --primary, shadow ring
Debounce: 300ms before firing search query
Clear (✕): appears inside input when text is present
```

### 4.3 Module Filter

```
Trigger: dropdown button "Module ▾" atau chip-group toggle
Options (single-select with "All" default):
  - All (default, no filter)
  - Leads         badge: --module-leads
  - Companies     badge: --module-companies
  - Contacts      badge: --module-contacts
  - Settings      badge: --module-settings

Style: Select dropdown OR segmented chip group
  Chip variant (recommended for ≤5 options):
    - All chips visible
    - Active: bg --primary, text white, weight 600
    - Inactive: bg white, border 1px --border, text --text-secondary
    - Height: 32px
    - Padding: 0 12px
    - Border-radius: 8px (or pill 16px)
    - Transition: 150ms ease

Active filter updates URL: ?module=leads
```

### 4.4 Date Range Filter

```
Trigger: dropdown button showing current range label
Default: "Last 30 Days"

Dropdown menu:
  Presets:
  - Today
  - Yesterday
  - Last 7 Days
  - Last 30 Days (default)
  - This Month
  - This Quarter
  ─────────────
  - Custom Range → expands inline date picker

Custom Range picker:
  - Two date inputs: "From" and "To"
  - Calendar popover for each
  - Apply button
  - Format: dd/mm/yyyy

Active filter: shows "Apr 1 – Apr 13" as label on trigger button
Updates URL: ?from=2026-04-01&to=2026-04-13
```

### 4.5 User Filter

```
Trigger: dropdown button "User ▾" or showing selected user's name
Default: "All Users"

Dropdown:
  - Search input at top (searchable)
  - User list: avatar (20px) + full name + role badge
  - Grouped by company if holding view
  - Selected: checkmark (✓) next to name

Style:
  - Max-height: 280px, scrollable
  - Width: 260px
  - Avatar: 20px circle, border-radius 50%
  - Name: 12px, weight 500
  - Role: 9.5px, --text-muted

Active filter: shows "Ahmad R." as label on trigger button
Updates URL: ?user=uuid
```

### 4.6 Clear Filters

```
Muncul HANYA saat ada filter aktif (selain default)
Text: "Clear filters" atau ✕ icon
Font: 11.5px, weight 500, color --primary
Click: resets semua filter ke default (All modules, Last 30 Days, All Users, empty search)
```

---

## 5. Team Activity Summary

Collapsible section di atas activity feed. Default: expanded.

### 5.1 Layout

```
┌─ Team Activity Summary ──────────────────────── Last 30 Days ── ▾ ─┐
│                                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │ 👤 Ahmad R.  │ │ 👤 Budi S.   │ │ 👤 Citra D.  │ │ 👤 Dina P. │ │
│  │ 42 activities│ │ 35 activities│ │  8 activities│ │ 15 actions │ │
│  │ ██████████░░ │ │ ████████░░░░ │ │ ██░░░░░░░░░░ │ │ ████░░░░░░ │ │
│  │ 12🟢 24🟣 6🟡│ │ 8🟢 20🟣 7🟡 │ │ 2🟢 5🟣 1🟡 │ │ 5🟢 8🟣 2🟡│ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│                                                                      │
│  ┌──────────────┐ ┌──────────────┐                                  │
│  │ 👤 Eko W.    │ │ 👤 Fani H.   │                                  │
│  │  3 activities│ │ No activity  │                                  │
│  │ █░░░░░░░░░░░ │ │ ░░░░░░░░░░░░ │                                  │
│  └──────────────┘ └──────────────┘                                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 Summary Card (per user) Specs

```
Card:
  Width: responsive, grid auto-fill minmax(160px, 1fr)
  Gap: 8px
  Background: --bg-card
  Border: 1px solid --border
  Border-radius: 8px
  Padding: 12px
  Cursor: pointer (click to filter by user)
  Hover: border-color --primary + "20", shadow subtle

Avatar: 24px circle
Name: 12px, weight 600, --text-primary, truncate if long
Activity count: 11px, weight 700, --text-primary
  "No activity" → 11px, italic, --text-muted (red-ish tint: #ef4444 at 60%)

Mini progress bar:
  Height: 4px, border-radius: 2px
  Background: --border-light
  Fill: proportional to max user count, color --primary
  Width: 100%

Action breakdown (below bar):
  Tiny colored dots with counts, inline
  🟢 = created, 🟣 = updated, 🟡 = stage moved
  Font: 9.5px, --text-muted
  Only show top 3 action types

Click → applies user filter to the feed below
Active state (when this user is filtered): border 2px --primary, bg --primary-light
```

### 5.3 Collapse / Expand

```
Header row:
  Title: "Team Activity Summary" — 13px, weight 700
  Period label: "Last 30 Days" (syncs with date filter) — 10.5px, --text-muted
  Toggle: chevron ▾ / ▴
  Click header → collapse/expand with smooth animation (max-height transition, 250ms)
  Collapsed: only header visible, no cards

Remember state: localStorage key "activity-summary-collapsed"
```

---

## 6. Activity Feed

### 6.1 Date Group Headers

Activities grouped by date. Each group has a sticky sub-header:

```
TODAY
─────────────────────────
(activities)

YESTERDAY
─────────────────────────
(activities)

MONDAY, APRIL 7, 2026
─────────────────────────
(activities)
```

**Specs:**
```
Date label: 10px, weight 700, uppercase, letter-spacing 1px, color --text-muted
Divider: 1px solid --border-light, extending full width
Margin: 20px top (except first group), 8px bottom
Position: sticky, top [header height], z-index 10, bg --bg-page
  → This makes date labels stick below the main header when scrolling
```

### 6.2 Activity Item (Collapsed — Default)

```
┌─ Timeline ──────────────────────────────────────────────────────────┐
│                                                                      │
│  ●  14:32   👤 Ahmad R.  updated  "Telkom Conference 2026"          │
│  │          LEADS    Changed: Stage Qualified → Proposal Sent        │
│  │                                                        ▸ Details  │
│  │                                                                   │
│  ●  14:15   👤 Budi S.   created  "Mandiri Gala Dinner"             │
│  │          LEADS    Revenue: Rp 1.2B · PIC: Budi S.                │
│  │                                                        ▸ Details  │
│  │                                                                   │
│  ●  13:48   👤 Admin     added stage  "Sales Pipeline"              │
│  │          SETTINGS   New stage: "Negotiation" (order: 4)          │
│  │                                                        ▸ Details  │
│  │                                                                   │
└──────────────────────────────────────────────────────────────────────┘
```

**Timeline structure:**
```
Container: padding-left 28px (space for timeline line + dot)

Timeline line:
  Position: absolute, left 14px, top 0, bottom 0
  Width: 2px
  Background: --timeline-line (#e5e8ed)

Timeline dot (●):
  Position: absolute, left 8px (centered on line)
  Width: 12px, height: 12px
  Border-radius: 50%
  Border: 2px solid white (creates ring effect over line)
  Background: action color (green/indigo/red/amber based on action type)
```

**Activity row specs:**
```
Padding: 12px 16px 12px 0 (left padding from timeline container)
Border-bottom: none (timeline line serves as visual separator)
Hover: bg rgba(99,102,241, 0.02) — very subtle
Cursor: pointer (click to expand)
Transition: background 100ms ease

Row 1 (primary):
  Time: 10.5px, weight 600, --text-muted, fixed-width 40px
  Avatar: 22px circle, margin 0 8px
  Actor name: 12px, weight 600, --text-primary
  Action verb: 12px, weight 400, --text-secondary
    - "created" = --positive color
    - "updated" = --primary color
    - "deleted" = --negative color
    - "moved" / "stage_changed" = --warning color
  Entity name: 12px, weight 600, --text-primary, in quotes
  Arrow (▸ Details): 10.5px, --text-muted, far right, visible on hover

Row 2 (secondary):
  Module badge: inline pill
    - Padding: 1px 7px
    - Border-radius: 4px
    - Font: 9px, weight 700, uppercase, letter-spacing 0.5px
    - Colors per module:
      LEADS:     bg #eef2ff, text #4338ca
      COMPANIES: bg #e0f2fe, text #0369a1
      CONTACTS:  bg #f3e8ff, text #6b21a8
      SETTINGS:  bg #f1f5f9, text #475569
  Change summary: 11px, weight 400, --text-secondary
    - For updates: "Changed: Stage Qualified → Proposal Sent"
    - For creates: key field values, e.g., "Revenue: Rp 1.2B · PIC: Budi"
    - For deletes: "Deleted permanently"
    - For settings: description of what changed
  Margin-left: aligned with actor name (after avatar)
```

### 6.3 Activity Item (Expanded)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ●  14:32   👤 Ahmad R.  updated  "Telkom Conference 2026"          │
│  │          LEADS                                         ▾ Collapse │
│  │                                                                   │
│  │  ┌─ Changes ──────────────────────────────────────────────────┐  │
│  │  │                                                             │  │
│  │  │  Pipeline Stage                                             │  │
│  │  │  ● Qualified  →  ● Proposal Sent                           │  │
│  │  │                                                             │  │
│  │  │  Revenue Estimate                                           │  │
│  │  │  Rp 800M  →  Rp 1.2B                                      │  │
│  │  │                                                             │  │
│  │  │  PIC Sales                                                  │  │
│  │  │  — (empty)  →  Ahmad R.                                    │  │
│  │  │                                                             │  │
│  │  └────────────────────────────────────────────────────────────┘  │
│  │                                                                   │
│  │  ┌──────────────────────────────────────┐                        │
│  │  │  View Lead →                         │                        │
│  │  └──────────────────────────────────────┘                        │
│  │                                                                   │
└──────────────────────────────────────────────────────────────────────┘
```

**Expanded section specs:**
```
Container:
  Margin-top: 8px
  Padding: 12px 16px
  Background: --bg-subtle (#fafbfc)
  Border: 1px solid --border-light
  Border-radius: 8px
  Animation: expand from 0 height, 200ms ease (use max-height + overflow)

Changes list:
  Each change:
    Field name: 10.5px, weight 600, --text-secondary, uppercase
    Values row:
      Old value: 12px, weight 400, --text-muted, with strikethrough (text-decoration)
      Arrow: "→" 12px, --text-muted, margin 0 8px
      New value: 12px, weight 600, --text-primary
    Stage change special:
      Show color dots (●) with stage colors before from/to names
    Separator between changes: 1px solid --border-light, margin 8px 0

"View Lead →" link:
  Font: 11.5px, weight 600, color --primary
  Click → navigate to the entity (lead sheet, company page, etc.)
  External link icon optional
```

### 6.4 Action-Specific Templates

**Lead Created:**
```
🟢 14:15  Ahmad R.  created  "Project Name"
          LEADS   Revenue: Rp 1.2B · Client: PT Telkom · Stage: Lead
```

**Lead Updated (generic):**
```
🟣 14:32  Ahmad R.  updated  "Project Name"
          LEADS   Changed 3 fields
          (expand to see all changes)
```

**Lead Stage Changed:**
```
🟡 14:32  Ahmad R.  moved  "Project Name"
          LEADS   ● Qualified → ● Proposal Sent
```

**Lead Deleted:**
```
🔴 14:45  Admin  deleted  "Old Project"
          LEADS   Deleted permanently
```

**Setting Changed (pipeline):**
```
🔵 13:48  Admin  added stage  "Sales Pipeline"
          SETTINGS   New stage: "Negotiation" (position: 4)
```

**Setting Changed (permission):**
```
🔵 11:20  Admin  updated permission  "WNW"
          SETTINGS   Staff: leads.delete → denied
```

**Member Added:**
```
🔵 10:05  Admin  added member  "Citra D."
          SETTINGS   Role: staff · Company: WNW
```

---

## 7. Infinite Scroll & Loading

```
Initial load: 50 items
Load more trigger: when user scrolls to within 200px of bottom
Loading indicator: skeleton rows (3 placeholder items with pulse animation)
End of data: "No more activities" text, centered, --text-muted
Error state: "Failed to load activities. [Retry]" with retry button

Skeleton row:
  Same layout as activity item but:
  - Avatar: 22px grey circle with pulse
  - Text: grey rounded rectangles with pulse
  - 3 skeleton rows shown while loading
  - Animation: shimmer/pulse, 1.5s infinite
```

---

## 8. Export Button

```
Position: top-right of header, aligned with title
Style: outlined button, --text-secondary border + text
Icon: download icon (↓) before text
Label: "Export"
Click → dropdown:
  - Export as CSV
  - Export as Excel (.xlsx)

Exporting state: button shows spinner + "Exporting..."
Complete: toast notification "Export complete — 342 activities"
Error: toast notification "Export failed. Try again."
```

---

## 9. Empty States

**No activities at all (new account):**
```
Centered in feed area
Icon: large clock/history illustration, 64px, --text-muted at 30%
Title: "No activity yet" — 15px, weight 600
Subtitle: "Activities will appear here as your team creates and updates leads, 
           companies, and contacts." — 12px, --text-secondary, max-width 400px
```

**No results for current filters:**
```
Centered
Icon: search/filter illustration, 48px
Title: "No matching activities" — 14px, weight 600
Subtitle: "Try adjusting your filters or search term" — 12px, --text-secondary
CTA: "Clear filters" — --primary, weight 600
```

---

## 10. Responsive

```
Desktop (≥1280px):
  Full layout as described
  Summary cards: 6 per row

Tablet (768-1279px):
  Summary cards: 3 per row
  Filter bar: search on first line, filters on second line (wrap)
  Activity rows: same layout, narrower

Mobile (≤767px):
  Summary: collapsed by default, 2 cards per row when expanded
  Filter bar: search full width, filters in collapsible "Filters" dropdown
  Activity rows:
    - Time and avatar on first line
    - Actor + action + entity on second line
    - Module badge + summary on third line
  Timeline line and dots: hidden (save horizontal space)
  Expanded changes: full width, no padding from timeline
```

---

## 11. Data Model

```typescript
// src/types/activity.ts

export type ActivityModule = 'leads' | 'companies' | 'contacts' | 'settings';

export type ActivityAction =
  | 'created' | 'updated' | 'deleted'
  | 'stage_changed' | 'assigned' | 'status_changed'
  | 'permission_changed' | 'stage_added' | 'stage_removed'
  | 'rule_created' | 'rule_updated' | 'rule_deleted'
  | 'member_added' | 'member_removed' | 'member_role_changed'
  | 'pipeline_created' | 'pipeline_deleted'
  | 'restriction_updated' | 'form_layout_changed';

export type ActivityEntityType =
  | 'lead' | 'company' | 'contact'
  | 'pipeline' | 'pipeline_stage' | 'transition_rule'
  | 'user' | 'permission' | 'form_layout';

export interface FieldChange {
  field: string;
  old_value: string | number | boolean | null;
  new_value: string | number | boolean | null;
}

export interface ActivityLog {
  id: string;
  created_at: string;
  company_id: string;
  user_id: string;
  module: ActivityModule;
  action: ActivityAction;
  entity_type: ActivityEntityType;
  entity_id: string | null;
  entity_name: string;
  changes: FieldChange[] | null;
  metadata: Record<string, unknown> | null;
  // Joined
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface ActivityFilters {
  module?: ActivityModule;
  userId?: string;
  dateFrom?: string;  // ISO date
  dateTo?: string;    // ISO date
  search?: string;
}

export interface UserActivitySummary {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  total_count: number;
  created_count: number;
  updated_count: number;
  stage_changed_count: number;
}
```

---

## 12. Database Schema

```sql
CREATE TABLE public.activity_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  module text NOT NULL CHECK (module IN ('leads', 'companies', 'contacts', 'settings')),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_name text NOT NULL DEFAULT '',
  changes jsonb,
  metadata jsonb,
  batch_id uuid  -- for grouping bulk operations
);

-- Performance indexes
CREATE INDEX idx_activity_company_date ON public.activity_logs (company_id, created_at DESC);
CREATE INDEX idx_activity_user ON public.activity_logs (user_id);
CREATE INDEX idx_activity_module ON public.activity_logs (module);
CREATE INDEX idx_activity_entity ON public.activity_logs (entity_type, entity_id);
CREATE INDEX idx_activity_search ON public.activity_logs USING gin (to_tsvector('english', entity_name));

-- RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: company members can read their company's logs (or all if holding)
CREATE POLICY "activity_logs_select" ON public.activity_logs FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

-- INSERT: authenticated users can insert for their own companies
CREATE POLICY "activity_logs_insert" ON public.activity_logs FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

-- NO UPDATE/DELETE — audit log is immutable
```

---

## 13. Trigger Example (Leads)

```sql
CREATE OR REPLACE FUNCTION public.fn_log_lead_changes()
RETURNS trigger AS $$
DECLARE
  v_action text;
  v_changes jsonb := '[]'::jsonb;
  v_metadata jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    INSERT INTO public.activity_logs (company_id, user_id, module, action, entity_type, entity_id, entity_name, metadata)
    VALUES (NEW.company_id, auth.uid(), 'leads', v_action, 'lead', NEW.id, COALESCE(NEW.project_name, ''), v_metadata);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Detect stage change
    IF OLD.pipeline_stage_id IS DISTINCT FROM NEW.pipeline_stage_id THEN
      v_action := 'stage_changed';
      v_metadata := jsonb_build_object(
        'from_stage_id', OLD.pipeline_stage_id,
        'to_stage_id', NEW.pipeline_stage_id
      );
    ELSE
      v_action := 'updated';
    END IF;

    -- Build changes diff (example for key fields)
    IF OLD.project_name IS DISTINCT FROM NEW.project_name THEN
      v_changes := v_changes || jsonb_build_array(jsonb_build_object('field', 'project_name', 'old_value', OLD.project_name, 'new_value', NEW.project_name));
    END IF;
    -- ... repeat for other important fields ...

    INSERT INTO public.activity_logs (company_id, user_id, module, action, entity_type, entity_id, entity_name, changes, metadata)
    VALUES (NEW.company_id, auth.uid(), 'leads', v_action, 'lead', NEW.id, COALESCE(NEW.project_name, ''), v_changes, v_metadata);
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    INSERT INTO public.activity_logs (company_id, user_id, module, action, entity_type, entity_id, entity_name)
    VALUES (OLD.company_id, auth.uid(), 'leads', v_action, 'lead', OLD.id, COALESCE(OLD.project_name, ''));
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_lead_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_lead_changes();
```

---

## 14. File Structure

```
src/
├── app/activity/page.tsx            # Activity history page (server component, fetches initial data)
├── features/activity/components/
│   ├── activity-feed.tsx            # Main feed with infinite scroll
│   ├── activity-item.tsx            # Single activity row (collapsed + expanded)
│   ├── activity-filters.tsx         # Filter bar (search + module + date + user)
│   ├── activity-summary.tsx         # Team activity summary cards
│   ├── activity-timeline.tsx        # Timeline line + dot rendering
│   ├── activity-changes.tsx         # Expanded changes diff view
│   └── activity-export.tsx          # Export button + logic
├── hooks/
│   └── use-activity-logs.ts         # Fetch + filter + paginate activity logs
└── types/
    └── activity.ts                  # Activity types
```

---

## 15. Checklist

### Database:
- [ ] Create `activity_logs` table with all columns
- [ ] Create performance indexes (company+date, user, module, entity, search)
- [ ] Create RLS policies (SELECT for members, INSERT for auth, no UPDATE/DELETE)
- [ ] Create trigger function for `leads` table (INSERT/UPDATE/DELETE)
- [ ] Create trigger functions for `pipeline_stages`, `transition_rules`, `company_members`, `role_permissions`
- [ ] Test trigger captures field-level diffs correctly
- [ ] Test stage_changed action fires on pipeline_stage_id change

### Types:
- [ ] Create `src/types/activity.ts` with all interfaces
- [ ] Export from `src/types/index.ts`

### UI — Header & Filters:
- [ ] Sticky header with hysteresis (fixed height, no layout shift)
- [ ] Search input with debounce (300ms)
- [ ] Module filter (chip group or dropdown)
- [ ] Date range filter with presets + custom range
- [ ] User filter with searchable dropdown
- [ ] Clear filters button (visible only when filters active)
- [ ] URL query params sync for all filters
- [ ] Export button with CSV/Excel options

### UI — Team Summary:
- [ ] Collapsible section with user cards grid
- [ ] Per-user: avatar, name, count, mini bar, action breakdown
- [ ] Click user → apply filter
- [ ] "No activity" state for inactive users
- [ ] Collapse state persisted in localStorage

### UI — Activity Feed:
- [ ] Date group headers (sticky sub-headers)
- [ ] Timeline line + colored dots
- [ ] Collapsed row: time, avatar, actor, action, entity, module badge, summary
- [ ] Expanded row: field changes with old → new values
- [ ] Stage change: visual color dots for from → to
- [ ] "View Entity" link per activity
- [ ] Infinite scroll with 50-item pages
- [ ] Loading skeleton rows
- [ ] Empty states (no data, no results)

### Responsive:
- [ ] Desktop: full layout
- [ ] Tablet: wrapped filters, 3-col summary
- [ ] Mobile: stacked layout, collapsible filters, hidden timeline dots

### Integration:
- [ ] Add "Activity" nav item to sidebar
- [ ] Activity page scoped by active company context
- [ ] Holding view shows cross-company activities
