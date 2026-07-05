# Supabase Setup Checklist

Run these in order in the **Supabase dashboard → SQL Editor**, then flip the
auth toggles. The app has fallbacks for every unapplied migration (it won't
crash), but the related feature silently won't persist until you run it.

## 1. SQL migrations — run in order

Paste each file's contents into the SQL Editor and run. Each is idempotent
(`if not exists` / `create or replace`), so re-running is safe.

| # | File | Adds | Without it |
|---|------|------|-----------|
| 1 | `supabase-migration.sql` | `lists`, `list_items`, `list_members` tables, RLS, `redeem_list_invite` RPC | App doesn't work at all (base schema) |
| 2 | `supabase-migration-v2.sql` | `list_items.category`, `lists.invite_expires_at`, `list_items.sort_order`, `remove_list_member` RPC | Categories, drag-order, member removal fail |
| 3 | `supabase-migration-v3.sql` | `lists.is_template`, `lists.archived_at` | Templates & archive do nothing |
| 4 | `supabase-migration-v4.sql` | `list_items.completed_at` (+ backfill) | Recent Activity / shared progress can't order completions |
| 5 | `supabase-migration-v5.sql` | `redeem_list_invite` rotates the code on join | Invite links stay reusable (not single-use) |
| 6 | `supabase-migration-v6.sql` | `user_categories` table + RLS | Custom category edits are session-only |
| 7 | `supabase-migration-v7.sql` | `is_list_member()` SECURITY DEFINER fn (RLS recursion fix) | Shared-member visibility broken (42P17) |
| 8 | `supabase-migration-v8.sql` | Drops the lists↔members policy cycle left by v7 | Lists don't load after v7 |
| 9 | `supabase-migration-v9.sql` | **Security hardening**: drops the collaborator lists-UPDATE policy (ownership-takeover hole), adds the members-can-leave delete policy, requires auth in `redeem_list_invite` | Collaborators can hijack lists via raw API; "Leave list" silently fails; invite codes burnable without auth |
| 10 | `supabase-migration-v10.sql` | **Share permissions**: `lists.invite_role`, `viewer` role, item-write policies gated to non-viewers via `can_edit_list()`, `set_member_role()` RPC, redeem joins at the link's level | "View only" sharing does nothing — everyone invited can still edit |

> If you're setting up fresh, run 1→10 top to bottom.
> If the project is already live, run only the ones you haven't yet.
> **v9 is a security fix — run it as soon as possible.**

## 2. Auth settings — Authentication → Providers / Settings

- [ ] **Allow new users to sign up** — ON (required for account creation)
- [ ] **Anonymous sign-ins** — ON. *Required for guests to join a shared list
      via invite link without creating an account.* If OFF, invites fail for
      exactly the people they're meant for.
- [ ] **Email provider** — enabled for email/password login.
- [ ] *(Optional)* **Confirm email** — ON for production; while testing you may
      leave it OFF so new signups can log in immediately.

## 3. Email deliverability (before launch)

- [ ] **SMTP** (Authentication → Emails) — plug in Resend / SES / Postmark.
      Supabase's built-in email sender is rate-limited to a handful per hour and
      is not meant for production signup/reset volume.

## 4. Optional providers (when ready)

- [ ] **Google** / **Apple** OAuth — the "Continue with Google/Apple" buttons on
      the login screen are wired to `signInWithOAuth`; enable the providers here
      and add the OAuth client credentials. Until then they show a friendly
      "not available yet" message.

## 5. Rate limits (dev convenience)

If you hit *"Too many attempts"* while testing, raise the limits under
**Authentication → Rate Limits** (token endpoint ~30/5min, anonymous 30/hr,
emails a few/hr by default).

---

### Quick verification after running everything

1. Sign up a new account → should land on the lists screen.
2. Create a shopping list, add items, check them off → "X of Y done" updates.
3. Share it → open the invite link in an incognito window → enter a name →
   should join and open the list (this exercises anonymous sign-in + the RPC).
4. Profile → Preferences → Manage Categories → add a category, reload → it
   persists (confirms v6).
