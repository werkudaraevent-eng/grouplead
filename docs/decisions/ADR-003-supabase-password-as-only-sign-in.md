# ADR-003: Supabase Password as the Only Sign-In Method

## Status
Accepted

## Date
2026-08-22

## Context

ADR-002 kept Microsoft Entra as the identity provider for both apps. Operating it exposed a problem the provider cannot solve: not every staff member has their own Microsoft account, and some sign in with an account inherited from a person who has left.

That breaks Sales Mission specifically. Mission attribution hangs on `auth.users.id` — `sales_missions.created_by` and `sales_mission_assignments.user_id`. When one human uses another human's account, "Results by sales" reports the wrong person, and the KPI that justifies the product becomes wrong.

It was also self-repairing in the wrong direction: both callback routes re-synced `profiles.full_name` from the Entra display-name claim on every login, so a name an admin corrected was overwritten on the user's next sign-in.

Entra also cannot be handed to a user who has no Entra account, and buying a licence per person to solve an attribution problem is disproportionate.

## Decision

Remove Microsoft sign-in from both applications. Supabase Auth email + password becomes the only sign-in method.

- Each human gets exactly one Supabase account. Accounts are not shared or handed down.
- `profiles.full_name` is the only source for a person's name. No provider claim overwrites it.
- Existing Azure users keep their `auth.users` row: a password is added to the same record, so `created_by`, `user_id`, and every other foreign key stay intact. No identity migration.
- Each app keeps its own login page. A user may enter the platform from either app.
- The OAuth callback routes are deleted. Password recovery runs through `/reset-password`, which never used them.

## Consequences

### Positive

- One account per human, so mission attribution and KPI reporting are correct.
- Staff without a Microsoft account get a real identity instead of borrowing one.
- The `full_name` overwrite disappears with the claim that caused it.
- No OAuth redirect surface: the class of bug where an unlisted `redirect_to` silently falls back to Site URL is gone.
- Azure App Registration, provider scopes, and claim parsing leave the codebase.

### Negative

- Entra MFA and conditional access are lost. Supabase Auth MFA (TOTP) is the replacement and must be enabled deliberately.
- Deactivating a user in Entra no longer locks them out of these apps. `profiles.is_active` becomes the deactivation control, and it is already enforced in `getSalesMissionAccess()`.
- Password policy, reset flow, and brute-force protection become ours. Enable leaked-password protection and keep Supabase's auth rate limits in place.
- Users must exist in Supabase before they can sign in; there is no provider-driven self-provisioning.

## Rollout

Deploying the removal before every account has a password locks those users out. Order matters:

1. Run `scripts/audit-password-identities.ts` to list accounts with no password identity.
2. Send each of them a recovery link so they set their own password. Never assign a password on their behalf — a recovery link means no admin sees the credential.
3. Re-run the audit until the "cannot sign in" count is zero.
4. Deploy the removal.
5. Disable the Azure provider in the Supabase dashboard.

Supabase's built-in SMTP is rate-limited to a few messages per hour, so configure a custom SMTP provider before step 2 on a team of any size.

## Guardrails

- One account per human. A shared or inherited account is an incident, not a workaround.
- Names come from `profiles.full_name`, never from a login provider.
- Recovery links are credentials until used. Distribute them over a trusted channel only.
- Enable MFA and leaked-password protection to offset what Entra used to enforce.
