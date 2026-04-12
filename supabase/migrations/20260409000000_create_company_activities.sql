create table if not exists public.company_activities (
    id uuid default gen_random_uuid() primary key,
    client_company_id uuid references public.client_companies(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete set null,
    profile_id uuid references public.profiles(id) on delete set null,
    action_type text not null,
    description text not null,
    field_name text,
    old_value text,
    new_value text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.company_activities enable row level security;

-- Policies
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
    using (auth.uid() = user_id);

-- Optional trigger to auto-set profile_id from user_id if needed, or we just join dynamically on user_id = profiles.id like in other places.
-- For now, we will rely on user_id, profile data will be joined via user_id -> profiles.id
