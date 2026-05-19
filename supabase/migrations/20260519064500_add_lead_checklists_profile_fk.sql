-- Repoint lead_checklists.assignee_id from auth.users → profiles so PostgREST
-- can embed `assignee:profiles!lead_checklists_assignee_id_fkey` (mirrors the
-- lead_activities.user_id → profiles pattern). profiles.id is itself a FK to
-- auth.users.id, so referential integrity is preserved.

ALTER TABLE public.lead_checklists
    DROP CONSTRAINT IF EXISTS lead_checklists_assignee_id_fkey;

ALTER TABLE public.lead_checklists
    ADD CONSTRAINT lead_checklists_assignee_id_fkey
    FOREIGN KEY (assignee_id) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- Reload PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
