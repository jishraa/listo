-- Run this AFTER supabase-migration-v4.sql
-- Single-use invite links: redeeming an invite rotates the list's code,
-- so a shared link stops working after the first person joins.
-- (The share sheet also regenerates the code every time it opens.)

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
  -- Rotate the code so this link can't be reused
  update public.lists
    set invite_code = lower(substr(md5(random()::text || clock_timestamp()::text), 1, 8))
    where id = v_list.id;
  return next v_list;
end;
$$;
