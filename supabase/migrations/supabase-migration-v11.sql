-- Run this AFTER supabase-migration-v10.sql
-- Invite-code isolation (July 2026 code review, P2): the invite secret lived on
-- the lists row, and the "members can read" policy lets any collaborator read
-- the whole row — so every collaborator received the raw invite_code and could
-- silently re-share the list to outsiders. RLS/column grants can't hide one
-- column from collaborators-but-not-owners because both are the same
-- `authenticated` Postgres role, so the fix is to move the secret onto its own
-- table whose ROW policy only admits the owner.

-- 1. Owner-only invite table. One live invite per list.
create table if not exists public.list_invites (
  list_id    uuid primary key references public.lists(id) on delete cascade,
  code       text not null unique,
  role       text not null default 'collaborator' check (role in ('collaborator', 'viewer')),
  expires_at timestamptz
);

alter table public.list_invites enable row level security;

-- Only the list's owner may see or manage its invite secret. Collaborators
-- (and everyone else) get zero rows — the code simply never reaches them.
drop policy if exists "owner manages invite" on public.list_invites;
create policy "owner manages invite" on public.list_invites
  for all
  using      (exists (select 1 from public.lists l where l.id = list_invites.list_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.lists l where l.id = list_invites.list_id and l.owner_id = auth.uid()));

-- 2. Migrate existing codes off the lists row.
insert into public.list_invites (list_id, code, role, expires_at)
  select id, invite_code, coalesce(invite_role, 'collaborator'), invite_expires_at
  from public.lists
  where invite_code is not null
  on conflict (list_id) do nothing;

-- 3. Redemption now reads/rotates list_invites (SECURITY DEFINER, so it sees
--    the owner-only table regardless of who's calling).
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
  -- Rotate so this link can't be reused.
  update public.list_invites
    set code = lower(substr(md5(random()::text || clock_timestamp()::text), 1, 8))
    where list_id = v_list.id;
  return next v_list;
end;
$$;

revoke execute on function public.redeem_list_invite(text, text) from anon;
grant  execute on function public.redeem_list_invite(text, text) to authenticated;

-- 4. Owner mints/rotates a link at a chosen access level and gets the fresh
--    code back. Replaces the old client-side update of lists.invite_code.
create or replace function public.rotate_invite(p_list_id uuid, p_role text)
returns text
language plpgsql
security definer
as $$
declare
  v_uid  uuid := auth.uid();
  v_code text := lower(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_role not in ('collaborator', 'viewer') then raise exception 'invalid_role'; end if;
  if not exists (select 1 from public.lists where id = p_list_id and owner_id = v_uid)
    then raise exception 'not_owner'; end if;

  insert into public.list_invites (list_id, code, role)
    values (p_list_id, v_code, p_role)
    on conflict (list_id) do update set code = excluded.code, role = excluded.role;
  return v_code;
end;
$$;

revoke execute on function public.rotate_invite(uuid, text) from anon;
grant  execute on function public.rotate_invite(uuid, text) to authenticated;

-- 5. Lets someone who is already a member/owner resolve a code → list id
--    without exposing the code itself (used to avoid stranding them on the
--    join screen). Only reveals the mapping to people already in the list.
create or replace function public.member_list_id_for_code(p_code text)
returns uuid
language sql
security definer
stable
as $$
  select li.list_id
  from public.list_invites li
  where li.code = p_code
    and (
      exists (select 1 from public.lists l where l.id = li.list_id and l.owner_id = auth.uid())
      or exists (select 1 from public.list_members m where m.list_id = li.list_id and m.user_id = auth.uid())
    )
  limit 1;
$$;

revoke execute on function public.member_list_id_for_code(text) from anon;
grant  execute on function public.member_list_id_for_code(text) to authenticated;

-- 6. Finally, remove the secret from the readable lists row.
alter table public.lists drop column if exists invite_code;
alter table public.lists drop column if exists invite_role;
alter table public.lists drop column if exists invite_expires_at;
