-- Run this AFTER supabase-migration-v9.sql
-- Share permissions (July 2026): a list can be shared as "Can edit" or
-- "View only". Viewers may READ a shared list but never write to it, and the
-- restriction is enforced in the database, not just the UI.
--
-- Model: list_members.role gains a third value 'viewer'. The invite link
-- carries the access level via lists.invite_role, so the owner picks the level
-- before sharing and every redemption of that link joins at that level. The
-- owner can also switch an existing member between 'collaborator' and 'viewer'
-- through the set_member_role RPC (owners themselves are never demotable).

-- 1. Access level baked into the current invite link (default keeps old links
--    behaving as full-edit collaborator invites).
alter table public.lists
  add column if not exists invite_role text not null default 'collaborator'
    check (invite_role in ('collaborator', 'viewer'));

-- 2. Allow the new 'viewer' role on membership rows. Drop any pre-existing
--    role check so we can widen the allowed set.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.list_members'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.list_members drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.list_members
  add constraint list_members_role_check
    check (role in ('owner', 'collaborator', 'viewer'));

-- 3. list_items writes now require a NON-viewer membership (or ownership).
--    The read policy is unchanged — viewers can still see everything.
--    A small helper keeps the three write policies readable and consistent.
create or replace function public.can_edit_list(p_list_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.list_members
    where list_id = p_list_id and user_id = auth.uid() and role <> 'viewer'
  ) or exists (
    select 1 from public.lists
    where id = p_list_id and owner_id = auth.uid()
  );
$$;

revoke execute on function public.can_edit_list(uuid) from public;
grant  execute on function public.can_edit_list(uuid) to authenticated;

drop policy if exists "members can insert items" on public.list_items;
create policy "editors can insert items" on public.list_items
  for insert with check (public.can_edit_list(list_id));

drop policy if exists "members can update items" on public.list_items;
create policy "editors can update items" on public.list_items
  for update using (public.can_edit_list(list_id));

drop policy if exists "members can delete items" on public.list_items;
create policy "editors can delete items" on public.list_items
  for delete using (public.can_edit_list(list_id));

-- 4. Redemption joins at the link's access level.
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
    values (v_list.id, v_uid, coalesce(v_list.invite_role, 'collaborator'), left(p_display_name, 50));
  -- Rotate the code so this link can't be reused
  update public.lists
    set invite_code = lower(substr(md5(random()::text || clock_timestamp()::text), 1, 8))
    where id = v_list.id;
  return next v_list;
end;
$$;

revoke execute on function public.redeem_list_invite(text, text) from anon;
grant  execute on function public.redeem_list_invite(text, text) to authenticated;

-- 5. Owner-only role switch. RLS has no UPDATE policy on list_members (and
--    would grant every column if it did), so changes go through this RPC.
--    Only the list owner may call it; the target must be a non-owner member of
--    that list; the new role is restricted to collaborator/viewer.
create or replace function public.set_member_role(p_member_id uuid, p_role text)
returns void
language plpgsql
security definer
as $$
declare
  v_uid     uuid := auth.uid();
  v_list_id uuid;
  v_target_role text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_role not in ('collaborator', 'viewer') then raise exception 'invalid_role'; end if;

  select list_id, role into v_list_id, v_target_role
    from public.list_members where id = p_member_id;
  if not found then raise exception 'member_not_found'; end if;
  if v_target_role = 'owner' then raise exception 'cannot_change_owner'; end if;

  if not exists (select 1 from public.lists where id = v_list_id and owner_id = v_uid)
    then raise exception 'not_owner'; end if;

  update public.list_members set role = p_role where id = p_member_id;
end;
$$;

revoke execute on function public.set_member_role(uuid, text) from anon;
grant  execute on function public.set_member_role(uuid, text) to authenticated;
