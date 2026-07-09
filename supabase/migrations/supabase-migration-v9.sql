-- Run this AFTER supabase-migration-v8.sql
-- Security hardening from the July 2026 code review. Three fixes:
--
-- 1. PRIVILEGE ESCALATION (P1): the v1 policy "members can update updated_at"
--    actually let any collaborator UPDATE *every* column of a shared list —
--    including owner_id (ownership takeover), name, invite_code, is_template
--    and archived_at. RLS cannot restrict columns, and the client only ever
--    bumps updated_at as the owner anyway, so the policy is pure attack
--    surface. Drop it. (Owner keeps full access via "owner full access".)
--
-- 2. BROKEN LEAVE (P1): list_members has no DELETE policy, so a collaborator
--    tapping "Leave" deleted 0 rows — the list silently reappeared on the
--    next refresh. Members may delete exactly their own non-owner row.
--
-- 3. UNAUTHENTICATED REDEEM (P1): redeem_list_invite is SECURITY DEFINER and
--    was callable with the bare anon key (no session), where auth.uid() is
--    NULL. That inserted ghost member rows (user_id NULL passes the
--    unique(list_id, user_id) constraint repeatedly) and burned the invite
--    code via rotation. Require a real uid and revoke anon execute — guest
--    joins use anonymous *sessions*, which carry the authenticated role.

-- 1. Collaborators can no longer update list rows at all
drop policy if exists "members can update updated_at" on public.lists;

-- 2. Members can leave a list (owners cannot orphan their own list this way)
drop policy if exists "members can leave" on public.list_members;
create policy "members can leave" on public.list_members
  for delete using (user_id = auth.uid() and role <> 'owner');

-- 3. Invite redemption requires an authenticated (incl. anonymous-session) user
create or replace function public.redeem_list_invite(p_code text, p_display_name text)
returns setof public.lists
language plpgsql
security definer
as $$
declare
  v_list  public.lists;
  v_uid   uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_list from public.lists where invite_code = p_code limit 1;
  if not found then raise exception 'invalid_code'; end if;
  if v_list.invite_expires_at is not null and v_list.invite_expires_at < now()
    then raise exception 'expired_code'; end if;
  if v_list.owner_id = v_uid then raise exception 'own_list'; end if;
  if exists (select 1 from public.list_members where list_id = v_list.id and user_id = v_uid)
    then raise exception 'already_member'; end if;
  insert into public.list_members (list_id, user_id, role, display_name)
    values (v_list.id, v_uid, 'collaborator', left(p_display_name, 50));
  -- Rotate the code so this link can't be reused
  update public.lists
    set invite_code = lower(substr(md5(random()::text || clock_timestamp()::text), 1, 8))
    where id = v_list.id;
  return next v_list;
end;
$$;

revoke execute on function public.redeem_list_invite(text, text) from anon;
grant  execute on function public.redeem_list_invite(text, text) to authenticated;
