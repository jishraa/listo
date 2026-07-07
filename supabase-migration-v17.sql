-- Run this AFTER supabase-migration-v16.sql
-- Multi-use invite links (product decision, 2026-07-07): v11 rotated the
-- invite code on every successful join, so a link shared in a group chat
-- admitted only the first tapper — everyone else got "invalid code".
-- Links now stay valid for any number of joins. Revocation is explicit:
-- the owner's "Reset link" action or an access-level switch (both call
-- rotate_invite), which invalidates all previously shared links at once.

create or replace function public.redeem_list_invite(p_code text, p_display_name text)
returns setof public.lists
language plpgsql
security definer
as $$
declare
  v_invite public.list_invites;
  v_list   public.lists;
  v_uid    uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_invite from public.list_invites where code = p_code limit 1;
  if not found then raise exception 'invalid_code'; end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now()
    then raise exception 'expired_code'; end if;
  select * into v_list from public.lists where id = v_invite.list_id limit 1;
  if not found then raise exception 'invalid_code'; end if;
  if v_list.owner_id = v_uid then raise exception 'own_list'; end if;
  if exists (select 1 from public.list_members where list_id = v_list.id and user_id = v_uid)
    then raise exception 'already_member'; end if;
  insert into public.list_members (list_id, user_id, role, display_name)
    values (v_list.id, v_uid, coalesce(v_invite.role, 'collaborator'), left(p_display_name, 50));
  -- No rotation here (changed from v11): the same link keeps working for
  -- the next invitee until the owner deliberately resets it.
  return next v_list;
end;
$$;

revoke execute on function public.redeem_list_invite(text, text) from anon;
grant  execute on function public.redeem_list_invite(text, text) to authenticated;
