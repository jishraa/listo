-- Run this AFTER supabase-migration-v15.sql
-- In-app account deletion (UX review, high 2.5; App Store guideline 5.1.1(v)
-- requires it for apps with account creation). The privacy policy's "contact
-- us to delete your account" is replaced by a self-serve Delete Account flow
-- in Profile → Account.
--
-- One statement does it all: every app table hangs off auth.users with
-- ON DELETE CASCADE — lists.owner_id (lists cascade on to list_items,
-- list_members, list_invites), list_members.user_id (memberships in other
-- people's lists), user_categories.user_id, item_history.user_id.
--
-- SECURITY DEFINER because clients can't touch the auth schema; the function
-- (owned by postgres via the SQL editor) can. It only ever deletes the caller.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from anon;
grant  execute on function public.delete_my_account() to authenticated;
