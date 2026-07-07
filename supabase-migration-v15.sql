-- Run this AFTER supabase-migration-v14.sql
-- Display-name sync (UX review, critical 1.3): renaming yourself in Profile →
-- Account only changed local state — useAuthStore.init() re-reads
-- user_metadata on the next launch, and collaborators kept seeing the old name
-- on shared lists. The client now persists the name to user_metadata AND syncs
-- it onto the user's list_members rows through this RPC.
--
-- Why an RPC: RLS deliberately has no UPDATE policy on list_members (a
-- self-serve UPDATE would also expose the role column — see v10 §5). This
-- SECURITY DEFINER function updates ONLY display_name and ONLY the caller's
-- own membership rows.

create or replace function public.set_my_display_name(p_name text)
returns void
language plpgsql
security definer
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := trim(p_name);
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if v_name is null or v_name = '' then raise exception 'invalid_name'; end if;

  update public.list_members
    set display_name = left(v_name, 50)
    where user_id = v_uid;
end;
$$;

revoke execute on function public.set_my_display_name(text) from anon;
grant  execute on function public.set_my_display_name(text) to authenticated;
