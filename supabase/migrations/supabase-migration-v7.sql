-- Run this AFTER supabase-migration-v6.sql
-- Fixes RLS infinite recursion on list_members.
--
-- The "members can read members" policy checked membership with a subquery
-- against list_members itself, which re-applies the same policy → error
-- 42P17 "infinite recursion detected in policy for relation list_members".
-- Result: a member could read only their own row, so shared-list member
-- counts/avatars never appeared.
--
-- Fix: a SECURITY DEFINER function evaluates membership with RLS bypassed,
-- so the policy no longer references list_members under its own policy.

create or replace function public.is_list_member(p_list_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.list_members
    where list_id = p_list_id and user_id = auth.uid()
  );
$$;

drop policy if exists "members can read members" on public.list_members;

create policy "members can read members" on public.list_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.lists
      where id = list_members.list_id and owner_id = auth.uid()
    )
    or public.is_list_member(list_members.list_id)
  );
