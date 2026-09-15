# Design direction, Sales Mission

Written down because the direction was previously only in someone's head, which
is how a form ends up with a wall of checkboxes and nobody able to say whether
that was a decision or an accident.

## Design Read

A field-operations tool for sales reps and the appointment team. Most screens
are read standing up on a phone with one hand, or worked through at a desk on a
wide monitor. Nothing here is marketing: every screen either answers "where am I
going next" or captures what happened.

**Dial: ENERGY 1 / RHYTHM 1 / MOTION 1.**

Calm, uniform, and near-static on purpose. A rep checking an address outside a
client's office is not an audience for personality, and motion on a slow field
connection reads as lag. Variation earns its place only where the content
genuinely differs (the live board is loud because it is read across a room).

## Where the rules come from

**Material Design 3 is the rulebook, not the skin.** We take its logic for
structure, spacing, hierarchy and component behaviour. We take none of its
palette, none of its shape system, and none of its component visuals. Swapping
our logo out must not leave something that looks like a Google product.

What we actually adopted:

| Concern | Rule taken | How it lands here |
|---|---|---|
| Touch target | 48dp minimum for anything tappable | Form controls and list rows are 48px. Where a control is drawn smaller for density (a chip's remove button at 28px), the hit area is expanded to 48px instead of inflating the control |
| Spacing | 4dp grid | Label to control 8px, field to field 20px, section to section 24px |
| Text fields | Label above, control, supporting text below; error text takes the supporting text's place | `FieldShell` in the mission form |
| Multi-value input | Input chips, each carrying its own remove affordance | Supporting sales |
| Menu vs search | A list short enough to read needs no search box | Search appears from 7 options up |
| Buttons | Filled is the primary action and sits at the trailing edge; secondary is outlined | Simpan filled, Batal outlined. On a phone the primary sits lowest, nearest the thumb |
| Surfaces | Three tones, each one step off the last: page, card, field. A card groups one subject; a divider separates a card's header from its body | Page `--background`, section cards `--card`, fields `--field`. Each form section is its own card |
| Text field outline | The outline is held to 3:1 against the surface it sits on (M3 `outline` role, WCAG 1.4.11) | `--input` is #7F8993: 3.56:1 on the card, 3.28:1 on the field fill. Focus swaps it for `--ring` |
| Status vs action | A status is a passive label; a thing the reader can do is a button. They never share a shape | Status is a colour dot plus sentence-case text, no container. Anything actionable (Terima, Join) is a real button in the Aksi column or on the card |
| Icons | Material Symbols (M3's own set), Rounded style, weight 400, drawn on the 24dp grid; an icon never carries meaning a label does not also carry | Generated into `components/icons` from `scripts/icons/map.json` by `npm run icons:generate` at the repo root. Export names are the ones the code already used, so a swap of the set is one map edit, not 200 file edits. Brand marks (four social icons) are not in Material Symbols and keep their previous stroke drawings |
| A wall display never scrolls; it turns pages | A panel with more rows than fit paginates on a timer with a page indicator and a progress bar (kiosk dashboards: Geckoboard, Grafana kiosk), rows declare their height so the list fits the box exactly; the type scale shrinks together on a short screen so the composition holds at 720p | Papan live: `FitList` measures the panel, fills it, cycles pages every 8s and resumes after the periodic reload; hero, counts and titles step down under 820px of height |
| Records list, dashboard summarises, tabs switch between them | A record type gets a list view of its own (filter, sort, open in context) separate from the analytics over it; the two are sibling views of one destination, so they are M3 primary tabs under one page title, not two navigation items (Salesforce list views vs dashboards, Pipedrive Activities vs Insights) | Laporan: tab Daftar (`/workspace/reports`) and Ringkasan (`/workspace/reports/ringkasan`); a row opens the mission at its report card; the mission list offers "Lihat laporan" as the outlined action on a reported row |
| Chips are M3 chips, not pills | 32dp tall, 8dp corners, outlined at rest, tonal (secondary container) with a leading check when selected, 48dp touch target from spacing; the full-round pill is for buttons and segmented buttons only, and the primary fill is for the one main action, never for a chosen answer | `ChoiceChip` / `ChipRow` on the report form and the mission filters; `--tonal` / `--tonal-foreground` tokens shared with the navigation indicator |
| Photos: camera first, thumbnails, one control per photo | A photo field starts with an outlined button that opens the camera on a phone and the picker elsewhere, a second button for the gallery; each photo is a thumbnail with its own remove control; a linear progress bar per upload; errors as supporting text; drag-and-drop only as a desktop extra; files downscaled on the device (Jobber, Zoho FSM; Google Forms file upload limits) | `PhotoField` on all three forms, `PhotoGallery` on detail pages; private bucket per company folder, signed URLs, files purged with the rows |
| Dialog: headline and actions stay, content scrolls | A dialog never grows past the window; only the region between the headline and the action row scrolls, with a divider at each end while there is more, and a thin scrollbar inside the rounded surface | `DialogBody` in the shared dialog: `-mx-6 px-6 min-h-0 flex-1 overflow-y-auto`, dividers appear only when scrollable; every form dialog wraps its fields in it |
| Editable after send, never silently | A sent record can be changed by its author inside a window and by an admin at any time; every change asks a reason and keeps the outgoing version (Salesforce field history, HubSpot activity edits, Google Forms "allow editing after submit"). Sending a record back with a note is the admin's other move | Laporan kunjungan: "Ubah laporan" with an inline reason, the window set in Aturan mission, "Minta klarifikasi" dialog for admins, and "Diubah N×" with the version list on the card |
| Data table column widths are decided, not discovered | The identifier column takes the remaining width and never wraps to three lines; every other column has a width sized to its content; lower-priority columns leave at narrower window classes before the table scrolls; truncated text carries its full value on hover (Gmail, HubSpot and Salesforce list views: fixed widths, the name column widest, secondary columns hidden or scrolled) | Prospek and Mission tables use a fixed layout with a colgroup; Pemegang / Sales utama leave below xl, Dibuat / Lokasi below 2xl; the phone list shows cards instead |
| Bulk entry beside single entry | A list that people build from a spreadsheet gets a paste-a-list path next to the one-at-a-time path, one item per line (Google Forms, HubSpot, Salesforce picklists); a multi-line paste into the single field is read as a list too | Editor opsi: "Tempel daftar" with a preview count and duplicates skipped; "Hapus semua" clears the draft with an inline Batalkan instead of a dialog, because nothing is written until Simpan |
| Carry known facts forward | A record made from an earlier step starts with that step's facts filled in and marked with their origin; the user confirms or replaces, never retypes (Salesforce event → contact, HubSpot meeting attendees) | Laporan kunjungan: the appointment contact is Kontak 1 with a "Dari janji temu" mark, removable, and offered back with one button when absent |
| Inbox before the record | A stage before the main object lives in its own list with passive statuses and a logged history, and converts into the main object rather than being edited into it (Pipedrive Leads Inbox, Salesforce Lead → Opportunity) | Prospek: statuses are dot + label, every contact attempt is a row, Confirmed is reached only by scheduling the visit, and a converted prospect shows its mission's fate |
| Admin-editable vocabulary over fixed semantics | Labels, colours and order are the team's; the kind the code acts on is locked at creation and shown with a lock and its reason | Pengaturan → Status prospek: rename, recolour, reorder, add, archive; never delete; one open and one won anchor always active |
| Destructive actions | Deleting is reversible by default: it moves to a bin, and only removing from the bin needs a confirming dialog that names the count. An admin restores; retention is 30 days | Mission list "Ke sampah", Pengaturan → Sampah with Pulihkan and Hapus permanen; the clear-all zone empties into the bin |
| Sign-in | Text fields 48dp, outlines at 3:1, the visibility toggle a focusable 40dp icon button, the filled button without a resting shadow, helper text at full contrast | Both apps' login pages |
| Rows needing attention | A list item that needs the reader is toned at its edge, not shouted at | 4px `--warning-foreground` left edge on the row or card; the demand itself is the button beside it |
| Labels | Sentence case. M3 dropped all-caps button and chip labels in 2021 | No uppercase, wide-tracked pills anywhere in a list. Uppercase stays on page eyebrows only |
| Picking a time | Day first, then time; busy blocks drawn and named, never hidden; a clash warns, it does not block (Calendly's two-panel shape, Google Calendar's "find a time") | `SchedulePicker`: month on the left, the chosen day as an hour timeline on the right with each assignee's visits as named blocks, the travel buffer shaded around them, the candidate drawn on top in primary or danger |

## What is ours, not Material's

- **Colour** comes from `app/globals.css` tokens only. Every pairing is held to
  WCAG AA against the surface it actually lands on, not against white by default.
- **Type** is Plus Jakarta Sans, chosen for its Indonesian-language legibility at
  small sizes, not for a Material type scale.
- **Radius** is the existing `rounded-md` / `rounded-xl` pair. No pill-everything.
- **Uppercase wide-tracked labels** belong to page-level breadcrumbs only. A
  heading inside a form is sentence case, because it is a heading and not a tag.

## Language

Indonesian throughout the product surface. English is for code and comments.
One word per concept: a field is a "field", not sometimes "kolom".
| Filtering a list | Search always visible; each facet a button that opens a checklist (values OR, facets AND); everything active repeated as removable chips; state in the URL (Linear, HubSpot, Notion) | `MissionFilterBar`: search + Status, Sales, Lokasi, Jenis, Tanggal facets, chips with × and "Bersihkan semua", `?q=&status=&sales=…` |
| Acting on many rows | Checkbox per row and in the header; a selection bar appears with the count and only the actions that apply to a set (Gmail, Linear) | `MissionTable` with `canDelete`: bar reads "N mission dipilih · Hapus · Batal"; confirm dialog states what cascades |
| Destroying everything | Type-to-confirm in a bordered danger zone, away from the list (GitHub) | Pengaturan → Data: "HAPUS SEMUA MISSION" phrase, checked again on the server |
| Audit trail | One line per action in plain words, who and when beside it, before/after a click away; filters for who, what, which, when (Salesforce Setup Audit Trail, HubSpot activity log) | Pengaturan → Riwayat aktivitas; rows written by database triggers, grouped per transaction |
| Dashboard vs screen | One configuration, two renderings: set it up where you can click, send exactly that to the display (Geckoboard, Grafana TV mode). The in-app view uses the app's tokens; only the screen inverts | Papan live: control bar (segmented range, facets, panel chips) → same options in the URL → "Tampilkan di layar" and "Buat tautan layar". Privacy (client names) is bound to the token, never to the URL |
| Selection vs action controls | Controls that change what is shown look different from controls that do something (M3 segmented button, filter chips vs filled/outlined buttons) | Segmented Hari ini/Minggu ini, facet buttons, toggle chips on the left; one filled action and one outlined action on the right |
| Surface layering | All surfaces from one neutral ramp tinted toward the primary, stepped a few percent apart: page < nav panel < card. Dividers are outline-variant (tinted), never black alpha. The nav's active item is the secondary-container indicator: tinted fill, primary text, no shadow (M3 tonal surfaces, navigation drawer) | `--background` #F6F8FB, `--sidebar`/`--muted` #EEF2F7, `--card` #FFFFFF, `--border` #D9E0E8, `--sidebar-primary` #D9E4F5. Same tokens in LeadEngine so switching apps does not change the material |
| Edit vs reschedule | One door for anyone who may change a thing; a separate "request" only for those who may not (Google Calendar: Edit + "send update to guests?"; Calendly: Reschedule as a request) | Ubah carries the schedule for the scheduler, the primary (per tenant rule) and admins, and asks for an optional reason when it changed; Usulkan jadwal lain remains only for supporting sales and centrally-scheduled units. No "Pindahkan jadwal" button |
| Board controls | Page action beside the title (as on every page); one toolbar row with what-to-show (segmented, facets) on the left and how-it-is-shown (live status, a "Tampilan" menu) on the right; view options in a menu, never as permanently-ticked chips (M3 top app bar, segmented button, menu) | `BoardActions` in the header slot, `BoardToolbar` under it; panel toggles are `DropdownMenuCheckboxItem`s |
| Dark distant screen | Tonal elevation (lighter washes of one neutral), no outlines; exactly one tinted container for the one thing the room should look at; a real type scale (display clock, headline hero, title sections); centred empty states (M3 dark theme, tonal surfaces) | `--board-surface-1/2` panels, `--board-primary-container` hero "Berikutnya/Sedang berlangsung", rows dimmed once past, the current one tinted |
