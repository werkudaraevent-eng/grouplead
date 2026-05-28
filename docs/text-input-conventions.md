# Text Input Conventions — Companies & Contacts

> Living reference for how user-typed text on Company / Contact forms
> is normalised, deduplicated, and gently corrected.
>
> Last updated 2026-05-25.

---

## Why this exists

CRMs that auto-uppercase or auto-rewrite user input feel cheap and
broken. CRMs that don't normalise at all end up with three flavours
of "PT Bank Central Asia" depending on who typed it last. We aim for
the middle ground every modern SaaS lands on: **be invisible when
the user gets it right, gently soft-suggest when they don't, never
force a rewrite the user did not consent to**.

The convention is a three-layer stack:

| Layer | When | What it does | Bypass-able? |
|-------|------|--------------|--------------|
| 1. Whitespace normalisation | Always, server-side at submit | trims + collapses runs of spaces, turns blank strings into NULL | No — pure hygiene |
| 2. Soft duplicate detection | Inline as the user types | Surfaces existing records that look like the same entity | Yes — informational only |
| 3. Smart title-case suggestion | Inline below the input | Detects ALL CAPS input and offers a one-click rewrite | Yes — user clicks "Use suggested" |

None of these layers ever block the save or rewrite the value
without explicit user action.

---

## Layer 1 — Whitespace normalisation

Source: `src/lib/text-normalize.ts`

```ts
normalizeWhitespace(value)
// "  Acme   Corp  " → "Acme Corp"
// "   "             → null
// null              → null

normalizeStringFields(payload)
// Walks every string-typed key, applies normalizeWhitespace.
// Walks string-arrays element-by-element, drops empty entries.
// Leaves numbers / booleans / nested objects untouched.
```

Every server-side mutation must call `normalizeStringFields(payload)`
before insert/update. Form components call this at `onSubmit` so the
displayed value matches what we store.

Email-style fields are special-cased to also `.toLowerCase()`. Phone
fields are pre-sanitised to digits + leading `+`. Both happen *before*
the whitespace pass.

---

## Layer 2 — Soft duplicate detection

Source: `src/lib/duplicate-detection.ts` + `src/components/shared/duplicate-hint.tsx`

```ts
findDuplicateCandidates(candidate, existing, getName, options, excludeId)
// Returns DuplicateMatch<T>[] sorted strongest → weakest.
// Match kinds: "exact" → "contains" → "prefix"
```

Normalisation strips Indonesian and international legal forms
("PT", "CV", "Tbk", "(Persero)", "Inc.", "Ltd.", "GmbH", …) so
"PT Bank Central Asia Tbk" and "Bank Central Asia" match as one
entity. We deliberately skip Levenshtein / fuzzy distance: it
produces noisy false-positives on Indonesian names and hides true
near-duplicates. Three explicit kinds are easier for users to read
than a similarity score.

In the UI:

- The form fetches the existing list (cheap query: `id, name`) when
  the modal opens.
- `<DuplicateHint />` lazily evaluates as the user types (≥ 4 chars).
- When matches appear, the user can click any to load it into focus
  (callers wire `onSelect` for navigation; default is just visual).
- Editing flows pass `excludeId` so a record never matches itself.

The hint never blocks submission.

---

## Layer 3 — Smart title-case suggestion

Source: `src/lib/text-normalize.ts` (delegates to
`src/utils/smart-title-case.ts`) + `src/components/shared/title-case-hint.tsx`

`suggestTitleCase` returns a rewrite *only* when:

- The value has ≥ 4 characters.
- ≥ 70% of letters are uppercase.
- The smart-cased version actually differs from the input.

Otherwise it returns `null` and the hint renders nothing.

The smart-case engine preserves Indonesian acronyms (`PT`, `CV`,
`Tbk`, `BCA`, `BNI`, `BUMN`, …) and international legal forms via
the `KNOWN_ABBREVIATIONS` set in `smart-title-case.ts`. To extend
that vocabulary, add to that set rather than duplicating logic.

---

## Where this is wired

| Form | File | Layer 1 | Layer 2 | Layer 3 |
|------|------|---------|---------|---------|
| Add / Edit Client Company | `src/features/companies/components/add-company-modal.tsx` | ✅ | ✅ (against `client_companies`) | ✅ |
| Add / Edit Contact | `src/features/contacts/components/add-contact-modal.tsx` | ✅ | ✅ (against `contacts`) | ✅ |
| Subsidiary / Holding | `src/features/companies/components/company-form.tsx` | ✅ | — (small dataset, low collision risk) | ✅ |

When you build a new entity form that takes user-typed names, follow
the same pattern.

---

## How not to break this

- **Do not import `smartTitleCase` directly** in form components.
  Use `<TitleCaseHint />`. The component encapsulates the threshold
  + delivery UX.
- **Do not auto-apply suggestions** on blur, on submit, or on
  paste. The user must click. This is a deliberate accessibility
  and trust choice.
- **Do not skip `normalizeStringFields`** even when you think your
  inputs are clean. Pasted data, autofill, and copy-paste from PDF
  routinely contain non-breaking spaces.
- **When extending duplicate detection** to a new entity, fetch a
  *projected* column list (`id, name` only — not `*`). The matcher
  is in-memory and we want the over-the-wire payload tiny.
- **When two pages need the same matcher**, share the predicate via
  `getName` rather than reimplementing the comparison. The matcher
  is type-generic (`<T extends { id: string }>`).

---

## Tests

```
src/lib/__tests__/text-normalize.test.ts        # 14 tests
src/lib/__tests__/duplicate-detection.test.ts   # 15 tests
```

Run: `npx vitest run src/lib/__tests__`

---

## Future work

- **Server-side enforcement**: today every form calls
  `normalizeStringFields` itself. Once the codebase grows server
  actions for `companies` / `contacts` (`src/app/actions/...`), wrap
  the action body in the same call. Pattern is `lead-actions.ts`.
- **Search-time normalisation**: a Postgres `name_normalized` GIN
  index would let typeahead pick up "PT Bank BCA" when the user
  types "bca" without scanning the whole table. Out of scope until
  performance requires it.
- **Acronym dictionary import**: today `KNOWN_ABBREVIATIONS` lives
  in code. If users want to add their own (e.g. internal product
  codes), promote it to a `master_options` row.
