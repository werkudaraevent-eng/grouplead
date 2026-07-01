# reference/ — Design Specs & Proposals

> **These files are NOT implemented features.**

This folder holds design specifications, UI mockups (`.html`, `.jsx`), and
proposal documents produced during planning. They describe *intended* or
*explored* designs — many predate the current implementation, and some were
never built or were built differently.

## How to treat this folder

- **Do not** assume anything here reflects live behaviour.
- When a file here conflicts with the code, **the code wins**. See the
  source-of-truth priority in the root [`README.md`](../README.md).
- For the current, accurate system description, read
  [`../docs/leadengine-system-overview.md`](../docs/leadengine-system-overview.md).

## What's here

| Type            | Examples                                                        |
|-----------------|-----------------------------------------------------------------|
| Spec documents  | `*-spec.md`, `requirements-*.md`, `*-ui-spec.md`                |
| UI mockups      | `*.html`, `*.jsx` (static visual references / handoffs)         |
| Redesign notes  | `dashboard-redesign-spec.md`, `chart-redesign-spec.md`, etc.   |

Keep new *proposals* here. Once something ships, document the real behaviour
in `docs/` and treat the spec as historical.
