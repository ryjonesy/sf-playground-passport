-- SF Playground Passport: per-user progress storage
create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;

create policy "read own progress" on public.user_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own progress" on public.user_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own progress" on public.user_progress
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update on public.user_progress to authenticated;
