-- Run this AFTER supabase-migration-v13.sql
-- List Memory: Listo learns what a user adds over time so building lists gets
-- faster. Every add records the item against the user's history; the client
-- reads it back for "your regulars" chips and type-ahead suggestions that know
-- the usual quantity. Per-user and private (RLS scopes rows to the owner).

create table if not exists public.item_history (
  user_id       uuid not null references auth.users(id) on delete cascade,
  name_key      text not null,               -- normalized (lower, single-spaced)
  display_name  text not null,               -- nicest-cased actual name last seen
  category      text,
  last_quantity text,
  count         int  not null default 1,
  last_used     timestamptz not null default now(),
  primary key (user_id, name_key)
);

alter table public.item_history enable row level security;

-- A user sees and manages only their own history.
drop policy if exists "own history" on public.item_history;
create policy "own history" on public.item_history
  for all
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Record one use of an item. Upsert bumps the count and refreshes recency;
-- category/quantity update only when a non-empty value is supplied so a later
-- bare add doesn't wipe a known category. SECURITY DEFINER + uid guard.
create or replace function public.record_item_use(p_name text, p_category text, p_quantity text)
returns void
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_key text := lower(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
begin
  if v_uid is null or v_key = '' then return; end if;
  insert into public.item_history (user_id, name_key, display_name, category, last_quantity, count, last_used)
    values (v_uid, v_key, btrim(p_name), nullif(p_category, ''), nullif(p_quantity, ''), 1, now())
  on conflict (user_id, name_key) do update set
    count         = item_history.count + 1,
    display_name  = btrim(p_name),
    category      = coalesce(nullif(p_category, ''), item_history.category),
    last_quantity = coalesce(nullif(p_quantity, ''), item_history.last_quantity),
    last_used     = now();
end;
$$;

revoke execute on function public.record_item_use(text, text, text) from public;
grant  execute on function public.record_item_use(text, text, text) to authenticated;
