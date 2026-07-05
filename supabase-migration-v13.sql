-- Run this AFTER supabase-migration-v12.sql
-- Collaborator activity re-sorts shared lists (code-review P2): since v9 locked
-- the lists UPDATE policy to owners, a collaborator adding/checking items could
-- no longer bump lists.updated_at — so the "most recently active" ordering and
-- "updated X ago" went stale for everyone whenever a non-owner made the change.
-- This SECURITY DEFINER function lets any member bump the timestamp (and only
-- that column), without reopening the general lists UPDATE hole v9 closed.

create or replace function public.touch_list(p_list_id uuid)
returns void
language plpgsql
security definer
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  update public.lists
    set updated_at = now()
    where id = p_list_id
      and (
        owner_id = v_uid
        or exists (select 1 from public.list_members m
                   where m.list_id = p_list_id and m.user_id = v_uid)
      );
end;
$$;

revoke execute on function public.touch_list(uuid) from public;
grant  execute on function public.touch_list(uuid) to authenticated;
