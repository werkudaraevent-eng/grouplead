-- ============================================================
-- Contacts and Companies: one flat row per record for the list pages.
--
-- The two list pages used to load every row (about 1,200 contacts and 730
-- companies) and search, filter, sort and page in the browser. They now ask
-- the database for one page at a time (lib/lists/*, app/actions/
-- list-page-actions.ts). Most of what a person searches, filters and sorts
-- by is a column of the row itself, but three things are names on another
-- record: a contact's company, the owner of a contact or a company, and a
-- company's parent. PostgREST cannot put an embedded column into a
-- top-level OR (the search box), and ordering parent rows by one depends on
-- its version, so these views carry those names as plain columns:
--
--   contact_list_rows         company_name, owner_name, owner_avatar_url
--   client_company_list_rows  owner_name, owner_avatar_url, parent_name
--
-- `security_invoker = true`: the views read with the caller's rights, so
-- row security on contacts, client_companies and profiles applies exactly
-- as it does to the base tables (a company the person cannot see gives a
-- null company_name, as the embed did). Nothing here widens what anyone
-- sees. Soft-deleted rows are left out, as the list always did; the column
-- stays so the app filters the view and the table the same way.
--
-- Read only. The pages write through the existing server actions on the
-- base tables. `anon` gets nothing; `authenticated` may select.
--
-- The app does not depend on this migration: until it is applied (or if a
-- view is ever dropped) the pages read the base tables instead, resolving
-- related-name filters through an id lookup and asking PostgREST for a
-- related order (lib/lists/list-queries.ts). Idempotent: each view is
-- dropped and recreated, so the file can be run again after an edit.
--
-- The column lists match the selects in lib/lists/contact-list.ts and
-- lib/lists/company-list.ts; a column added to a list must be added here
-- too (until then the page falls back to the base table, it does not
-- break).
-- ============================================================

BEGIN;

DROP VIEW IF EXISTS public.contact_list_rows;
CREATE VIEW public.contact_list_rows
WITH (security_invoker = true) AS
SELECT
    c.id,
    c.salutation,
    c.full_name,
    c.email,
    c.phone,
    c.job_title,
    c.contact_source,
    c.created_at,
    c.client_company_id,
    c.secondary_email,
    c.secondary_phone,
    c.secondary_emails,
    c.secondary_phones,
    c.linkedin_url,
    c.notes,
    c.date_of_birth,
    c.address,
    c.social_urls,
    c.owner_id,
    c.needs_enrichment,
    c.company_id,
    c.deleted_at,
    cc.name       AS company_name,
    p.full_name   AS owner_name,
    p.avatar_url  AS owner_avatar_url
FROM public.contacts c
LEFT JOIN public.client_companies cc
    ON cc.id = c.client_company_id
   AND cc.deleted_at IS NULL
LEFT JOIN public.profiles p
    ON p.id = c.owner_id
WHERE c.deleted_at IS NULL;

COMMENT ON VIEW public.contact_list_rows IS
    'Contacts list page: live contacts with the company and owner names flattened for search, filter and sort. security_invoker; read by lib/lists/list-queries.ts.';

REVOKE ALL ON public.contact_list_rows FROM PUBLIC, anon;
GRANT SELECT ON public.contact_list_rows TO authenticated;

DROP VIEW IF EXISTS public.client_company_list_rows;
CREATE VIEW public.client_company_list_rows
WITH (security_invoker = true) AS
SELECT
    cc.id,
    cc.name,
    cc.industry,
    cc.line_industry,
    cc.website,
    cc.phone,
    cc.address,
    cc.area,
    cc.street_address,
    cc.city,
    cc.postal_code,
    cc.country,
    cc.parent_id,
    cc.owner_id,
    cc.created_at,
    cc.account_status,
    cc.needs_enrichment,
    cc.custom_data,
    cc.company_id,
    cc.deleted_at,
    p.full_name      AS owner_name,
    p.avatar_url     AS owner_avatar_url,
    parent.name      AS parent_name
FROM public.client_companies cc
LEFT JOIN public.profiles p
    ON p.id = cc.owner_id
LEFT JOIN public.client_companies parent
    ON parent.id = cc.parent_id
   AND parent.deleted_at IS NULL
WHERE cc.deleted_at IS NULL;

COMMENT ON VIEW public.client_company_list_rows IS
    'Companies list page: live client companies with the owner and parent names flattened for search, filter and sort. security_invoker; read by lib/lists/list-queries.ts.';

REVOKE ALL ON public.client_company_list_rows FROM PUBLIC, anon;
GRANT SELECT ON public.client_company_list_rows TO authenticated;

COMMIT;

-- PostgREST must see the new views before the pages can use them.
NOTIFY pgrst, 'reload schema';
