# Listo — Architecture

How the code is organized and the rules that keep it maintainable.
(Established July 2026; see TESTING.md for the quality gates that enforce
behavior across refactors.)

## Layers

```
pages/          Route components. Thin orchestrators: state, data wiring,
                and which feature pieces are visible. No heavy JSX blocks.
features/       Feature modules (list-detail, insights, lists). Presentation
                components + pure logic that belongs to one feature only.
components/ui/  Shared primitives: Sheet, ConfirmSheet, IconButton, Avatar,
                PullIndicator. Cross-feature, design-system level.
components/     Older shared components (lists/ sheets, layout/ shell).
store/          zustand stores. Own STATE ONLY: optimistic updates, rollback,
                offline-queue hand-off, realtime reconciliation.
lib/api/        Repository layer. ALL Supabase IO — queries, RPCs, realtime
                channels, schema-compat fallbacks. Nothing else talks to
                supabase-js (only useAuthStore, a thin auth wrapper, does).
lib/            Pure domain logic (parsers, matchers, duplicates, analytics
                live under features/*/), storage key registry, utils.
hooks/          Cross-page hooks (useEnsureData, usePullToRefresh, useSafeBack).
```

## Rules

1. **IO only in `lib/api/`.** Components never import supabase; stores call
   api functions and own the optimistic/queue logic around them. This is what
   makes store behavior unit-testable (see `store/*.test.ts` — the api layer
   is mocked).
2. **Bottom sheets use `components/ui/Sheet`** (or `ConfirmSheet` for
   confirmations). Never hand-roll `.sheet-overlay`/`.sheet` markup — Sheet
   carries the dialog semantics (Escape stack, focus trap, exit animation).
3. **Destructive actions confirm through `ConfirmSheet`.** One look, one
   behavior, everywhere.
4. **localStorage goes through `lib/storage.ts`.** Every key lives in the
   `storageKeys` registry; no inline `listo-*` literals.
5. **Prefer primitives over inline styles** for anything that exists twice
   (Avatar, IconButton, chips). Tokens (`index.css`) for every color/radius —
   no new magic hex values.
6. **Feature logic that can be pure, is pure.** `features/insights/analytics.ts`
   is the model: plain functions over plain data, regression-tested with
   known inputs. Components compute nothing they could import.
7. **Pages stay under ~800 lines.** When a page grows a distinct concern
   (a card, a sheet, a row renderer), it moves to its feature folder.
8. **Schema changes = a new numbered `supabase/migrations/supabase-migration-vN.sql`**, applied
   manually in the Supabase dashboard. Client code must tolerate the previous
   schema (see the PGRST204 fallbacks in `lib/api/items.ts`).

## Data flow

```
component ── calls ──▶ store action
                        │  optimistic set / rollback
                        ├─ online ──▶ lib/api ──▶ Supabase
                        └─ offline ─▶ useSyncStore queue ─(reconnect)─▶ lib/api
Realtime: lib/api/items.subscribeToItems ─▶ store reconciliation
Offline cache: zustand persist (lists/items/members) hydrates on cold start.
```

Server-side authority: RLS + SECURITY DEFINER RPCs (invites, roles, account
ops). The client UI mirrors permissions but the database is the boundary.

## Deliberate non-choices

- **No React Query/SWR** — the offline queue + realtime + persist design
  covers server state; a cache library would fight the replay semantics.
- **No CSS-in-JS/Tailwind** — tokens + utility classes + primitives.
- **No separate backend** — SQL RPCs are the backend at this scale.
