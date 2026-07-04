-- Run this AFTER supabase-migration-v5.sql
-- Per-user category customization (add/update/delete categories).
-- One row per user holding the full category map as JSONB, seeded
-- client-side from the built-in defaults on first edit.

create table if not exists public.user_categories (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  categories  jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.user_categories enable row level security;

create policy "own categories select" on public.user_categories
  for select using (auth.uid() = user_id);
create policy "own categories insert" on public.user_categories
  for insert with check (auth.uid() = user_id);
create policy "own categories update" on public.user_categories
  for update using (auth.uid() = user_id);
create policy "own categories delete" on public.user_categories
  for delete using (auth.uid() = user_id);
