# AGENTS.md

Instructions for any coding agent working in this repository. Read this before
touching anything; it is the only thing that travels between machines, accounts
and tools.

## What this repo is

A npm-workspace monorepo (`apps/*`, `packages/*`) holding **two Next.js 16 / React 19
applications that share one Supabase project and one login**.

| | Sales Activity | LeadEngine |
|---|---|---|
| Path | `apps/sales-mission` | `apps/leadengine` |
| Package | `@werkudara/sales-mission` | `@werkudara/leadengine` |
| Production | `mission.werkudara.group` | `crm.werkudara.group` |
| Dev port | 3001 | 3000 |
| What it is | Field sales: plan a visit, assign a team, record what happened | Internal CRM: leads, contacts, companies, goals |
| Product copy | **Indonesian** | **English** |
| DB schema | `sales_mission` | `public` |

**Neither app has a `src/` directory.** Both are flat at the app root: `app/`,
`components/`, `lib/`, `hooks/`, `utils/`, `types/`, plus `features/`, `config/`
and `contexts/` in LeadEngine. Any document that says otherwise is out of date.

## Commands

Run from the app directory you are changing:

```bash
cd apps/sales-mission        # or apps/leadengine
npx tsc --noEmit             # types
npx vitest run               # unit tests (vitest, node environment, no DOM)
npx next build               # production build, which also lints
npm run dev                  # 3001 for sales-mission, 3000 for leadengine
```

Root scripts exist but **default to LeadEngine**: plain `npm run dev`, `npm run
build`, `npm test` all target LeadEngine only. Use `npm run dev:sales-mission`,
or just `cd` into the app.

## Before every commit

Run the whole chain in the app you touched, in this order, and do not commit
until all three are clean:

1. `npx tsc --noEmit`
2. `npx vitest run`
3. `npx next build`
4. If the change includes a migration, apply it (see below) before committing.

Report failures honestly with their output. Never describe work as done when a
step was skipped.

## Git and deploys

Work happens **directly on `main`**, and publishing is a plain `git push`.

**Never push any other branch.** Every branch pushed to the remote triggers a
Vercel preview build alongside the production one for the same commit, and the
Hobby plan's daily deployment limit has already been hit once that way. Previews
are not wanted; production only.

Until 2026-09-18 the work sat on `feature/sales-mission-foundation` and was
published with `git push origin HEAD:main`. That idiom kept previews away but
advanced neither the local `main` ref nor the branch's own remote, so local
`main` fell 190 commits behind and `git status` reported the branch as "98
ahead" of a stale upstream — which reads as "nothing has been pushed" when in
fact everything had. An agent on this machine drew exactly that conclusion. If
you ever see a large ahead/behind count here, check
`git rev-list --count origin/main..HEAD` before believing it. A stale
`feature/sales-mission-foundation` still exists on the remote at an old commit;
leave it alone unless asked.

`.claude/settings.local.json` is tracked but must be **excluded from every
commit** — it is a per-machine permission list. Stage with
`git add -A -- ':!.claude/settings.local.json'`.

End commit messages with the attribution lines the session's own instructions
give you. Commit or push only when asked.

## Database and migrations

One Supabase project serves both apps. **Every migration for both apps lives in
`apps/leadengine/supabase/migrations`**, including the `sales_mission` schema's.
There is no `supabase/` directory under `apps/sales-mission`.

```bash
cd apps/leadengine
npx supabase db push --linked
```

Without a laptop, the **Migrate** workflow (`.github/workflows/migrate.yml`)
runs the same push from the Actions tab: the default mode is a dry run that
lists what is pending, "apply" runs it. It needs the repository secrets
`SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`. A migration run by hand in
the SQL Editor is unknown to the CLI's history; pass its version in the
workflow's "mark as applied" input (or `npx supabase migration repair --status
applied <version>`) so it is not run again.

New migrations are timestamped `.sql` files. Keep `NOTIFY pgrst, 'reload
schema';` outside the transaction when you change a function signature or add a
column PostgREST must see. There is no single canonical schema file: the schema
is the cumulative result of the migrations, and `schema.sql` is a legacy
snapshot — do not trust it.

**Never read from or write to the production database with a service-role
script.** Diagnose through the app, through migrations, or by asking. Fetching a
public feed URL for diagnosis is fine; anything holding the service-role key is
not.

## Design

Material Design 3 is the foundation for both apps — **as rules and logic, not as
a look**: component structure, spacing, hierarchy, colour roles, states, and how
a control is supposed to behave. Global products are references, never something
to copy.

Every UI decision and its reasoning is recorded as a row in the app's own
`DESIGN.md` (`apps/sales-mission/DESIGN.md`, `apps/leadengine/DESIGN.md`). The
format is: rule, why it is the rule with its references, and where it lands in
the code. **Read the relevant rows before changing a screen, and add or rewrite
a row in the same commit as the change.** A DESIGN.md row that no longer matches
the code is worse than no row.

Half-changes are not acceptable. If a rule implies three adjustments, make all
three.

## Product copy and documentation

- Sales Activity is Indonesian throughout; LeadEngine is English. One word per
  concept, matching the product's own vocabulary: in Sales Activity a *prospek*
  is a plan, an *aktivitas* is an appointment, a *laporan* is a visit that
  happened.
- Ship a changelog entry **in the same commit as the feature**, written for sales
  and admins rather than developers: `apps/sales-mission/lib/changelog.ts`
  (newest first) and `apps/leadengine/features/changelog/changelog-data.ts`.
- If a change adds or alters a rule a user must follow, update the guide in the
  same commit: `apps/sales-mission/app/workspace/panduan/page.tsx`.

## Sales Activity specifics

- Server actions live in `app/actions/`, return `ActionResult` from
  `types/action-result.ts`, and validate with zod v4 schemas in `lib/`.
- RLS is the security boundary for session-bound reads. Pages with no session
  (the TV board, the public calendar, the iCalendar feed) use
  `createServiceClient()` from `utils/supabase/service.ts`, and **every query
  made with it must filter by `company_id` explicitly** — that filter is the
  boundary, not RLS.
- Public routes are listed in `proxy.ts`; the token in the URL is the credential.
- The activity, report and prospect forms are **admin-configurable**: fields, their
  order, labels and requiredness come from tenant config (`lib/missions/form-fields.ts`).
  A field's `reportingKey` is frozen at creation and can drift from its current
  label, so always resolve key → label at render time.
- Scrolling: the shell owns it. Never call `Element.scrollIntoView` or bare
  `.focus()` — both ask every ancestor to scroll and slide the whole page. Use
  `scrollInPanel` / `jumpToField` from `lib/ui/scroll-in-panel.ts`.

## LeadEngine specifics

- **`companies` ≠ `client_companies`.** `companies` are internal tenant business
  units used for access scoping; `client_companies` are CRM customer
  organisations attached to leads and contacts. Confusing them breaks queries and
  RLS.
- Company scoping goes through `scopedQuery()` in `utils/supabase/scoped-query.ts`;
  holding companies see everything. `fn_user_company_ids()` and
  `fn_user_has_holding_access()` drive RLS.
- Never show "Unspecified" without checking entity relations first: use
  `resolveLeadField()` from `lib/resolve-lead-field.ts` (lead field →
  client_company field → null).
- Currency comes from the `useCurrency()` hook in `contexts/currency-context.tsx`.
  Never hardcode "Rp" or write a local formatter. Chart axis labels use `fmtAxis`,
  which is always compact.
- Lead writes go through a column whitelist in `app/actions/lead-actions.ts`. A
  new lead column must be added there or it is silently dropped.
- `lead_tasks` and `/dashboard/tasks` are legacy and outside the active product.

## Environment

Each app needs its own `.env.local`; see `apps/*/.env.example`, which documents
every variable and why it exists. Both apps point at the same Supabase project
and share an auth cookie on the parent domain, so one login covers both.
`SUPABASE_SERVICE_ROLE_KEY` is server-only and must never reach browser code.

The AI connection (proxy endpoint, API key, model names) is **not** an
environment variable in production: it lives in the shared `public.ai_settings`
row, the key in Supabase Vault, and is edited from either app's Settings → AI
page. `AI_PROXY_URL` / `AI_PROXY_KEY` / `AI_MODEL_*` are read only while that
row is empty. Both apps reach it through `lib/ai/ai-settings.ts`
(`resolveAiConfig()`), which uses the service client because the key is behind
`fn_ai_read_key`, a function only the service role may call; every caller
checks the person's grant first.

Every AI proxy call from either app logs one row to `public.ai_usage`
(service role only) through `lib/ai/ai-usage.ts`; the Pemakaian / Usage card
under Settings → AI sums it. A new AI feature must call `recordAiUsage`.

The daily AI insight is written by `POST /api/ai/insights/run` in Sales
Activity, called every ten minutes by Supabase Cron (`pg_cron` + `pg_net`,
scheduled in migration `20260920110000_ai_insights.sql`) with a bearer token
that lives in Vault as `ai_cron_secret`. The route decides what is due per unit
(the morning run at the unit's hour, a rewrite after new reports); changing the
hour is a settings change, never a cron change. The job's URL is production's;
previews are never called by the schedule.

## Gotchas

- Root `npm run dev` / `build` / `test` silently mean LeadEngine. Always say
  which app you ran.
- Files under `reference/` are proposals, not implemented features. When
  `README`, `docs/` or `reference/` disagrees with the code, the code wins.
- `.claude/DASHBOARD_*.md` are leftovers from old sessions, not specifications.
- On Windows, bash heredocs carrying complex content (JSX, nested quotes) fail
  with "unexpected EOF". Write a Python script to the scratchpad directory and
  run it instead of inlining a heredoc.
