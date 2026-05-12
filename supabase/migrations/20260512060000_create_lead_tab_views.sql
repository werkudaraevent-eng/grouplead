-- Track when each user last viewed each tab on a lead detail page.
-- Powers the "unread" badge dots on Scope/Notes/Timeline/Tasks tabs.
create table if not exists public.lead_tab_views (
    user_id uuid not null references auth.users(id) on delete cascade,
    lead_id bigint not null references public.leads(id) on delete cascade,
    tab text not null check (tab in ('scope', 'notes', 'timeline', 'tasks')),
    last_viewed_at timestamptz not null default now(),
    primary key (user_id, lead_id, tab)
);

-- Index for the polling query: "latest lead_activities.created_at > user's last_viewed_at"
create index if not exists idx_lead_tab_views_user_lead
    on public.lead_tab_views (user_id, lead_id);

alter table public.lead_tab_views enable row level security;

-- Each user can only see/write their own rows
create policy "lead_tab_views_select_own"
    on public.lead_tab_views
    for select
    using (user_id = auth.uid());

create policy "lead_tab_views_insert_own"
    on public.lead_tab_views
    for insert
    with check (user_id = auth.uid());

create policy "lead_tab_views_update_own"
    on public.lead_tab_views
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "lead_tab_views_delete_own"
    on public.lead_tab_views
    for delete
    using (user_id = auth.uid());

comment on table public.lead_tab_views is
    'Per-user, per-lead, per-tab last-viewed timestamp. Used to compute unread badges on lead detail tabs.';
