# ADR-005: The CRM Is the Database of Everyone Visited

## Status
Accepted

## Date
2026-09-13

## Context

A company only reached LeadEngine from Sales Mission when a rep pushed a lead. Most visits never produce a lead. So the accounts that had been visited three times with no opportunity, which is where the relationship work actually happens, had no record in the CRM at all: no company, no contact, no date.

At the same time, the only guard against duplicate companies was a case-sensitive unique index on the raw name plus six code paths with three different ideas of "already exists". Production held "Asuransi BRI Life" twice, differing by one space, and "Sriboga Marugame Indonesia" with and without a trailing "PT". Two reps submitting the same new company in the same second would both pass the check and both insert.

## Decision

**Submitting a visit report registers the company and the people met in the CRM.** Not creating the mission, and not pushing a lead. The visit happened, someone was met, the facts are in the report. A visit where nobody was met (client absent, cancelled on site) does not register anything; there is no relationship to record.

**Creating a lead stays manual**, through the existing modal with its owner warning and duplicate check. The pipeline is not the database; the company list is.

**One record per company, enforced by the database.** `client_companies.name_normalized` is a generated column (lowercase, punctuation removed, PT/Tbk/Inc-style tokens stripped from the edges) with a partial unique index over active rows. Every writer goes through `fn_find_or_create_client_company`, which catches the unique violation and returns the winner. This is the only construction that survives a race; a check-then-insert in application code never does.

**Uniqueness is global, not per business unit.** Every company row in production has no tenant set and is visible to every unit. Scoping the index by tenant would allow the same company twice across that boundary, which is the thing being fixed.

**Duplicates that slip through are merged, not deleted.** `fn_merge_client_companies` moves leads, contacts, notes, attachments, activity, subsidiaries and Sales Mission visits to the survivor, fills its blanks from the loser, and retires the loser to the Recycle Bin marked "merged into". The Companies list offers Merge when exactly two rows are selected. A merged row cannot be restored; its data is not there any more.

**Ownership from a visit is fill-only.** A company created from a visit is owned by the primary sales. An existing owner is never changed by a visit. Changing an owner is the lead-push modal's job, where the warning lives.

**Contacts follow the same rule.** Find-or-create by name within the company; an existing contact has blank fields filled and nothing overwritten. Rows created this way carry `contact_source = 'Sales Mission'`.

## Consequences

- LeadEngine can answer "when were we last there" for accounts with no lead. Each visit is a `meeting` entry on the company timeline, one per mission.
- The CRM registration on submit can fail (LeadEngine down, role without the `companies` grant). The report still submits. The mission page shows the outcome honestly and offers a retry.
- "PT Arunika Kreasi" and "Arunika Kreasi Tbk" are now the same company everywhere: form, import, API, and Sales Mission. A parent and a subsidiary that differ only by legal form must be named with a real distinguishing word.
- Three existing duplicate pairs were merged by the migration, keeping the row with the most attached data.
- The import screens and the Add company modal now report "already exists as X" instead of a raw unique-violation.
