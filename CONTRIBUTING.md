# Contributing to LeadEngine

This guide covers day-to-day workflow. Architectural rules and domain
conventions live in [`AGENTS.md`](AGENTS.md) — read that too.

## Setup

See the [README](README.md#getting-started) for install + environment setup.

## Before you push

Run the same checks CI runs (see `.github/workflows/ci.yml`):

```bash
npm run typecheck   # must pass — strict mode, zero errors
npm run lint        # must pass on files you touched
npm test            # unit tests
npm run build       # production build
```

Add or update tests when you add a feature or fix a bug. Tests live alongside
feature code in `src/features/*/lib/__tests__/`.

## Branches

- Never commit directly to `main`. Create a feature branch:
  - `feat/<short-name>` — new features
  - `fix/<short-name>` — bug fixes
  - `chore/<short-name>` — tooling, docs, housekeeping
- Push with upstream tracking: `git push -u origin <branch>`.

## Commits

- Use [Conventional Commits](https://www.conventionalcommits.org/):
  `type(scope): summary` — e.g. `fix(dashboard): correct custom-range date boundary`.
- Common types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`.
- Keep commits focused. Stage specific files rather than `git add .` so
  unrelated changes and secrets (`.env.local`) don't slip in.

## Pull requests

- Open a PR into `main`. Keep titles under ~70 characters.
- Describe: what changed, what you tested, and anything intentionally left out.
- CI must be green before merge.

## Database changes

- Add timestamped SQL files to `apps/leadengine/supabase/migrations/`
  (`YYYYMMDDHHMMSS_description.sql`). Make them idempotent where possible.
- **All migrations live there, including Sales Mission's.** Both apps share one
  Supabase project, and `apps/leadengine/supabase/config.toml` is the only
  linked project directory — the CLI cannot see migrations anywhere else. Sales
  Mission migrations used to sit under `apps/sales-mission/supabase/`, where
  `db push` silently ignored them and the migration history never recorded a
  single one.
- Apply with the Supabase CLI, run from `apps/leadengine`:
  `supabase db push --linked` (preview first with `--dry-run`).
- Never apply a migration by hand through the dashboard or a service-role
  script. The change lands but the history does not record it, and the next
  person cannot tell what a fresh environment would actually build.
- There is **no single schema file** — the schema is the cumulative result of
  all migrations. `schema.sql` is a legacy snapshot; do not treat it as current.

## Code style

- Server Components by default; Client Components only when interactivity is
  needed. All writes go through Server Actions in `src/app/actions/`.
- UI uses shadcn/ui (new-york). Add components via `npx shadcn add <component>`.
- Use theme CSS variables (`bg-primary`, `text-muted-foreground`, …) — don't
  hardcode raw colors for chrome.
- Path alias `@/*` maps to `src/*`.
- Follow the field-resolution, currency, and server-action patterns documented
  in [`AGENTS.md`](AGENTS.md).

## Things not to commit

- `.env.local` or any real secrets (use `.env.example` as the template).
- One-off scratch/debug scripts (already git-ignored: `scratch*.js`, etc.).
- Real customer data (the `sample/` folder is git-ignored).
