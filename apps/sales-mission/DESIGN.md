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
