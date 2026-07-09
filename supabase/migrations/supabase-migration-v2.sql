-- Run this AFTER supabase-migration.sql (adds missing columns)

-- Add category to list_items
alter table public.list_items
  add column if not exists category text default null;

-- Add invite expiry to lists
alter table public.lists
  add column if not exists invite_expires_at timestamptz default null;

-- Add sort_order to list_items (for drag-to-reorder)
alter table public.list_items
  add column if not exists sort_order integer default 0;

-- RPC: redeem_list_invite
-- Validates the code, checks expiry, inserts membership, returns the list row.
-- SECURITY DEFINER bypasses RLS so non-members can resolve the code.
create or replace function public.redeem_list_invite(p_code text, p_display_name text)
returns setof public.lists
language plpgsql
security definer
as $$
declare
  v_list  public.lists;
  v_uid   uuid := auth.uid();
begin
  select * into v_list from public.lists where invite_code = p_code limit 1;
  if not found then raise exception 'invalid_code'; end if;
  if v_list.invite_expires_at is not null and v_list.invite_expires_at < now()
    then raise exception 'expired_code'; end if;
  if v_list.owner_id = v_uid then raise exception 'own_list'; end if;
  if exists (select 1 from public.list_members where list_id = v_list.id and user_id = v_uid)
    then raise exception 'already_member'; end if;
  insert into public.list_members (list_id, user_id, role, display_name)
    values (v_list.id, v_uid, 'collaborator', left(p_display_name, 50));
  return next v_list;
end;
$$;

-- RPC: remove_list_member (owner only)
create or replace function public.remove_list_member(p_list_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from public.lists where id = p_list_id and owner_id = auth.uid())
    then raise exception 'not_owner'; end if;
  delete from public.list_members where id = p_member_id and list_id = p_list_id
    and role != 'owner';
end;
$$;
