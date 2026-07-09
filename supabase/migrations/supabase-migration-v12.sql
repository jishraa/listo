-- Run this AFTER supabase-migration-v11.sql
-- Shared-link join flow: to show an invite *preview* (which list, whose, how
-- many members) before the visitor picks how to authenticate, we need a safe,
-- read-only lookup by code. The lists row is unreadable to strangers (that's by
-- design), and the invite secret lives on the owner-only list_invites table, so
-- this is a SECURITY DEFINER function returning ONLY non-sensitive display
-- fields for a valid, unexpired code. No membership, no secret, no writes.

create or replace function public.invite_preview(p_code text)
returns table (
  list_id      uuid,
  name         text,
  emoji        text,
  type         text,
  owner_name   text,
  member_count int
)
language sql
security definer
stable
as $$
  select
    l.id,
    l.name,
    l.emoji,
    l.type,
    coalesce(
      (select m.display_name from public.list_members m
       where m.list_id = l.id and m.role = 'owner' limit 1),
      'Someone'
    ),
    (select count(*)::int from public.list_members m where m.list_id = l.id)
  from public.list_invites li
  join public.lists l on l.id = li.list_id
  where li.code = p_code
    and (li.expires_at is null or li.expires_at > now())
  limit 1;
$$;

-- Anyone opening the link can preview it — including a not-yet-signed-in
-- visitor (anon) deciding whether to continue as guest or make an account.
revoke execute on function public.invite_preview(text) from public;
grant  execute on function public.invite_preview(text) to anon, authenticated;
