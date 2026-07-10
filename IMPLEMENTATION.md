# Listo — Implementation Notes

How the major features actually work under the hood. Pairs with
[`ARCHITECTURE.md`](ARCHITECTURE.md) (layer rules) and
[`docs/VISION.md`](docs/VISION.md) (what's a roadmap item vs. shipped).

## Smart input & categorization

`lib/constants.ts` — `parseItemInput(raw)` splits free text into
`{ item, qty }` (`"Milk ×2"`, `"Rice 2kg"` → item + quantity, no separate
quantity field in the Add Item UI). `LIST_CATEGORIES` holds per-list-type
keyword tables; `detectCategoryIn(categories, text)` does whole-word,
longest-keyword-wins matching against the user's *current* category set —
always call it with `useCategoriesStore` categories, never the static
`detectCategory`, so per-user renames/merges are respected.

`useCategoriesStore` seeds from `LIST_CATEGORIES`, persists customization as
JSONB on `user_categories` (migration v6), and is managed at `/categories`.

## List Memory ("Your regulars")

`item_history` table + `record_item_use()` RPC (migration v14), owned by
`useMemoryStore`. Every completed/added item upserts a per-user row (item
name, category, last quantity, use count). Powers:
- **Your regulars** — frequently-used items surfaced when adding to a list
- **Type-ahead with usual quantities** — typing an item name suggests the
  quantity you used last time
- **Before You Go** — regulars missing from the current list

Pure ranking/matching logic is unit-tested independent of the store.

## Duplicate detection

`lib/duplicates.ts` — flags likely-duplicate items while typing (normalized
name comparison against the list's current pending items), offered as a
merge/skip prompt rather than blocking entry.

## Sharing & permissions

Invite links are the *only* join path (`/join/:code`, no manual code entry).
- `list_invites` — owner-only invite secret, one active link per list
  (migration v11); `rotate_invite()` mints a new code, `invite_preview()`
  (SECURITY DEFINER, callable by `anon`) returns non-secret list info (name,
  emoji, owner, member count) so an unauthenticated visitor can see what
  they're joining before signing in.
- `redeem_list_invite(code, display_name)` — SECURITY DEFINER RPC; validates
  code + expiry, inserts the membership. Links are multi-use (revoked only
  by the owner rotating/resetting the link).
- Roles: `owner | collaborator | viewer`. `can_edit_list()` gates item-write
  RLS policies; `set_member_role()` / `remove_member_list()` are owner-only
  RPCs. The client mirrors role-based UI, but **RLS is the actual
  boundary** — every table has policies that hold even if the client is
  bypassed.
- `touch_list()` lets any member bump `lists.updated_at` so shared lists
  re-sort correctly when a collaborator (not the owner) changes something.

Guests are Supabase **anonymous auth** users (`user.is_anonymous`); their
display name lives in `localStorage`, not `user_metadata`, since anonymous
users have no profile row. See [`docs/AUTH.md`](docs/AUTH.md) for the full
session lifecycle.

## Offline-first sync

`useSyncStore` — an item-level mutation queue (`add | update | delete`),
persisted via zustand `persist`. While offline: writes apply optimistically
to `useListsStore` and are pushed onto the queue with a client-generated
`opId`/`tempId`. On reconnect, the queue replays FIFO through `lib/api/items`.
Conflict strategy is **last-write-wins**; an op against a row that was
deleted remotely (or whose permissions changed) fails permanently and is
dropped rather than blocking the rest of the queue. List-level operations
(create/rename/share/archive/delete) are intentionally **online-only** — no
queue for those.

Realtime reconciliation: `lib/api/items.subscribeToItems` pushes remote
changes into the store; `useSyncStore` and the realtime path share the same
optimistic-apply/rollback code so a queued op and an incoming realtime event
converge on the same state.

## Insights & analytics

`features/insights/analytics.ts` — pure functions over a list's item/member
data (no IO), regression-tested with fixed inputs. `ShoppingInsights.tsx`
renders the result inside `ListDetail`'s overflow menu (per-list only — see
the IA decision in [`CLAUDE.md`](CLAUDE.md): no dashboard/global Insights
tab).

## Reports (PDF / CSV export)

`lib/report.ts` builds a report from `List`/`ListItem`/`ListMember` plus the
user's category labels (`useCategoriesStore`), renders it with `jspdf` +
`jspdf-autotable` (PDF) or a CSV blob, and delivers it via
`navigator.share({ files })` where available, falling back to a download
anchor. Both are lazy-loaded — `jspdf` is excluded from the initial bundle
(see the bundle budget in [`TESTING.md`](TESTING.md)).

## PWA & offline shell

`vite-plugin-pwa` (`generateSW` mode) precaches the built assets and serves
the SPA shell offline; `InstallBanner` + `hooks/useInstallPrompt` surface the
native install prompt. Offline *data* is the zustand `persist` cache
(lists/items/members hydrate on cold start) layered with the sync queue
above — the service worker only owns static assets, not app state.

## Native shells (Capacitor)

`capacitor.config.ts` — `webDir: dist`, appId `app.listo.lists`. `ios/` and
`android/` are native project shells wrapping the same web build (no
platform-specific feature code beyond `@capacitor/app`/`@capacitor/browser`
for OAuth redirect handling). After any Capacitor-related change, run
`npm run sync` (`build` + `cap sync`) before opening Xcode/Android Studio.

## YFT companion integration

`lib/yft.ts` — a single URL constant pointing at Listo's companion finance
tracker (YFT). Surfaced only at contextual moments (shopping complete,
insights, reports), never as an ad unit. Principle: manage *shopping* in
Listo, *spending* in YFT — Listo doesn't duplicate budget tracking.
