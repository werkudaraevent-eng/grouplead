# LeadEngine design rules

The CRM follows Material Design 3 as rules and logic (structure, spacing,
hierarchy, colour, how a control behaves), never as a visual copy, with
global platforms (HubSpot, Salesforce, Linear, Notion) as references for
patterns Material leaves open. The sibling app records the same discipline
in `apps/sales-mission/DESIGN.md`; the two apps share a session, a colour
system and a set of shell behaviours, and should read as one product.

| Area | Rule (and where it comes from) | Where it lives |
|---|---|---|
| Tokens, not hex | Every colour is a token from `app/globals.css` (M3 tonal surfaces: `--background` surface, `--sidebar` surface-container-low, `--card` surface-container-lowest, `--border` outline-variant, `--primary`, `--secondary`, `--accent`, `--warning`, `--success`). A raw hex or Tailwind palette colour in a component is a bug, because it cannot follow a theme or a rebrand | `components/ui/*`, `components/shared/*` |
| List pages | Page header with the one primary action; then one toolbar exactly one row tall: an M3 search bar (pill, leading icon, trailing clear, debounced), filter chips in a rail that scrolls sideways rather than wrapping, and secondary actions as 40dp round icon buttons with tooltips. Saved views appear as choice chips only once a view exists; the first is saved from the toolbar. The list never moves because the toolbar grew (M3 top app bar, filter chips, icon buttons; Linear, Attio) | `ListToolbar`, `SearchField`, `FilterBuilder layout="rail"`, `ToolbarIconButton`, `ColumnsMenu`, `SaveViewButton`, `SavedViewsBar` |
| Data table | Header on surface-container-low, 52dp rows, one hairline between rows, hover as a tonal wash, selection as a primary tint, frozen leading columns with one edge shadow, the row's actions as a trailing round icon button that appears on hover or focus, a fixed-height footer with the range on the left and paging on the right (M3 data table, list item, pagination) | `components/ui/table.tsx`, `components/shared/list-table.tsx`, `ListFooter`, `InitialsAvatar`, `NeedsDetailsBadge` |
| Chips | Filter chips are 32dp pills: tonal (`bg-primary/12 text-primary`, leading check) when they narrow the list, outlined otherwise; choice chips (roles, saved views) the same shape with one selected (M3 chips) | `filter-builder.tsx`, `saved-views-bar.tsx`, `settings/permissions/page.tsx` |
| Who may see and change what | Role & Izin: modul × Lihat/Buat/Ubah/Hapus with a reach (Cakupan) under Lihat and Ubah; role chips on top, one pane, the reading guide folded | `app/(app)/settings/permissions/page.tsx` |
| Switching apps | A transit screen on leaving and a loader on arrival, both on the shared preference cookies, so the sidebar arrives at the width the person left it at | `components/layout/{app-transit,app-switcher,top-loader}.tsx`, `lib/preference-cookie.ts` |

Out of scope for now, recorded so it is not mistaken for a rule: the list
pages still fetch a whole table and filter, sort and page in the browser;
server-side paging is a separate change.
