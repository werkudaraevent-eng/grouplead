create table if not exists public.company_activities (
    id uuid default gen_random_uuid() primary key,
    client_company_id uuid references public.client_companies(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete set null,
    action_type text not null,
    description text not null,
    field_name text,
    old_value text,
    new_value text,
    attachment_name text,
    attachment_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.company_activities enable row level security;

create policy "Enable read access for authenticated users"
    on public.company_activities for select
    to authenticated
    using (true);

create policy "Enable insert access for authenticated users"
    on public.company_activities for insert
    to authenticated
    with check (true);

create policy "Enable delete access for the author"
    on public.company_activities for delete
    to authenticated
    using (auth.uid() = user_id);;
