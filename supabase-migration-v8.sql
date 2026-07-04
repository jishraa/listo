-- Run this AFTER supabase-migration-v7.sql
-- v7 stopped the list_members SELF-recursion, but left a branch that queries
-- the lists table — and lists' own "members can read" policy queries
-- list_members right back, forming a lists ↔ list_members cycle that breaks
-- loading. This removes that branch: is_list_member() already covers owners
-- (an owner has their own list_members row), so the lists lookup is redundant.

-- Ensure the membership helper is callable by client roles.
grant execute on function public.is_list_member(uuid) to authenticated, anon;

drop policy if exists "members can read members" on public.list_members;

create policy "members can read members" on public.list_members
  for select using (
    user_id = auth.uid()
    or public.is_list_member(list_members.list_id)
  );
