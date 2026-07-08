# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Listo — Smart Lists for Everyday Life** is a collaborative list PWA (grocery/shopping, tasks, personal lists) built with React 19 + TypeScript + Vite, deployed to web via Cloudflare Pages and to iOS/Android via Capacitor. Product vision and roadmap live in `docs/VISION.md` — consult it before proposing features; every feature must serve one of the UX goals there (save time/money/effort, improve planning, collaborate better, better decisions).

Deployed as a Cloudflare Worker serving static assets only (`wrangler.jsonc`, SPA fallback via `not_found_handling`). Share links use the full `/join/:code` URL — a TinyURL integration was tried and removed at the user's request (don't reintroduce shorteners).

## Development Commands

```bash
npm run dev        # Vite dev server
npm run verify     # full quality gate: lint → tests+coverage → build → bundle budget (see TESTING.md)
npm run build      # tsc -b && vite build
npm run lint       # oxlint (not eslint)
npm test           # vitest — unit tests (lib/) + component tests (jsdom, RTL + axe-core)
npm run deploy     # verify + wrangler deploy — a failing gate blocks the deploy
npm run sync       # build + cap sync (after Capacitor-related changes)
npm run open:ios / open:android
```

`npm run verify` must pass before pushing; CI (`.github/workflows/ci.yml`) runs the same gate on every push/PR. Testing conventions and the QE roadmap live in `TESTING.md`.

## Architecture

Layer rules (IO only in `lib/api/`, sheets via `components/ui/Sheet`, storage via `lib/storage.ts`, feature folders) live in `ARCHITECTURE.md` — read it before structural changes.

### Routes (`src/App.tsx`)

| Path | Page | Notes |
|---|---|---|
| `/login` | Login | Email/password + Google/Apple OAuth; Create Account UX with password rules; `?mode=register` deep-links sign-up; `?next=` resumes a destination after auth |
| `/reset-password` | ResetPassword | Password-recovery landing (target of the reset email link) |
| `/terms`, `/privacy` | Legal | Static legal pages (no auth guard) |
| `/join/:code` | JoinList | Invite-link landing (no auth guard); the only place guest (anonymous) sign-in is offered |
| `/about` | Landing | Public marketing page (also shown at `/` to signed-out visitors) |
| `/` | Lists | Root tab: filter chips (Active/Shared/Completed/Archived), sort, search (name/member/category), templates. `/lists` and `/insights` redirect here |
| `/profile` | Profile | Second tab (inside AppShell — bottom nav persists): profile card + nav rows + sign out. No inline settings |
| `/list/:id` | ListDetail | Items, members, share, Shop Mode, per-list insights, PDF/CSV export (drill-in — renders outside the shell) |
| `/categories` | Categories | Per-user category management (drill-in) |
| `/profile/*` | pages/profile/ | Drill-in screens: account (incl. change password + delete account), preferences, collaboration, invite, support, help, about — sharing `profile/common.tsx` (SubPage/Section/Row) |

`/` and `/profile` are children of `RootGate`, which renders the public Landing (signed-out at `/`), redirects other shell paths to `/login`, or renders `AppShell` (`components/layout/`) — one persistent shell owning the bottom nav (Lists / + / Profile), the center-FAB Create List sheet, and lists-store init + items/members loading. Drill-in routes are wrapped in `AuthGuard`. Lazy loading: everything one tap past the entry screens, plus jspdf (report export).

Bottom sheets must use `components/ui/Sheet.tsx` (dialog semantics, Escape-to-close, exit animation) — don't hand-roll `.sheet-overlay`/`.sheet` markup.

**IA decision (2026-07-03):** the user removed both the Home dashboard tab and the standalone Insights tab — insights live only at the per-list level (the Insights sheet in ListDetail's overflow menu). Lists is the root screen. Do NOT reintroduce a dashboard/Home tab or a global Insights tab without being asked. Joining shared lists happens only via the secure `/join/:code` invite link — no manual code entry anywhere.

### Stores (`src/store/`) — zustand

| Store | Purpose |
|---|---|
| `useAuthStore` | Session, user, `displayName`, `isGuest` (Supabase anonymous auth), signOut |
| `useListsStore` | Lists, items, members; Supabase CRUD + realtime; templates (`saveAsTemplate`/`createFromTemplate`) and archiving (`setArchived`) |
| `useThemeStore` | `pref: 'light' \| 'dark' \| 'system'`; `applyTheme()` sets `data-theme` on `<html>` |
| `useSyncStore` | Offline mutation queue: item-level writes made offline are applied optimistically, persisted, and replayed FIFO on reconnect (list-level ops stay online-only) |
| `useMemoryStore` | List Memory (`item_history` table, migration v14): per-user add history powering "Your regulars", type-ahead with usual quantities, and "Before You Go" |
| `useCategoriesStore` | Per-user category customization (seeded from `LIST_CATEGORIES` defaults, persisted as JSONB in `user_categories`, migration v6); managed at `/categories`. Use `detectCategoryIn(cats, text)` with store categories, not the static `detectCategory` |

Go through store helpers for Supabase access; don't call Supabase directly from components.

### Supabase (numbered `supabase-migration*.sql` files, currently through v16)

Tables: `lists` (name, type, emoji, owner_id, is_template, archived_at), `list_items` (title, quantity, completed, category, sort_order, added_by_name, completed_by_name, completed_at), `list_members` (list_id, user_id, role owner|collaborator|viewer, display_name), `list_invites` (owner-only invite secret, one per list — v11), `user_categories` (v6), `item_history` (List Memory, v14).

Templates and archived lists are regular `lists` rows flagged by `is_template` / `archived_at` — no separate tables. Every "normal" list view must filter through the store's exported helpers `visibleLists` / `templateLists` / `archivedLists` (rows loaded before migration v3 lack the columns, so the helpers use truthiness, never `=== false`).

RPCs (SECURITY DEFINER): `redeem_list_invite(code, display_name)` — validates code + expiry, inserts membership; links are multi-use since v17 (revoked only by the owner's Reset link / access switch); raises `invalid_code` / `expired_code` / `own_list` / `already_member`. `rotate_invite` / `invite_preview` / `member_list_id_for_code` — invite mint/preview/resolve. `remove_list_member` + `set_member_role` — owner only. `touch_list` — members bump `updated_at`. `record_item_use` — List Memory. `set_my_display_name` (v15) + `delete_my_account` (v16) — self-serve profile ops.

Guests are Supabase **anonymous users** (`user.is_anonymous`); their display name lives in localStorage, not user_metadata.

### Domain (`src/lib/` + `src/types/`)

- `types/index.ts` — `List`, `ListItem`, `ListMember`, `ListType = 'personal' | 'tasks' | 'shopping'`
- `constants.ts` — `LIST_CATEGORIES` (per-type keyword-matched categories for auto-categorization) and `parseItemInput(raw)` → `{ item, qty }` (smart input: "Milk ×2", "Rice 2kg")
- `utils.ts` — `generateInviteCode()`, `formatRelativeTime()`, list type labels/emojis

### Components

- `components/lists/` — `AddItemSheet`, `CreateListSheet`, `SwipeRow`
- `components/ui/Sheet.tsx` — bottom sheet primitive
- `InstallBanner` + `hooks/useInstallPrompt` — PWA install prompt

## Design System

Minimal, premium, readable. CSS custom properties in `src/index.css`, themed via `data-theme` on `<html>`. Key tokens: `--accent` (primary green `#16A34A` family), `--accent-dim`, `--accent-glow`, `--bg-input`, `--border` / `--border-2`, `--text` / `--text-2` / `--text-3`. Utility classes: `.card`, `.btn` (+ `btn-primary`/`btn-secondary`/`btn-ghost`/`btn-danger`/`btn-sm`/`btn-full`), `.input`, `.badge`, `.header`, `.page`, `.app-container`, `.spinner`.

Palette (vision): primary `#16A34A`, accent `#14B8A6`, light bg `#F8FAFC`, dark bg `#0F172A`.

## Key Constraints

- `npm run build` (which runs `tsc -b`) must pass before pushing.
- Linter is **oxlint** — avoid patterns its parser rejects (e.g. IIFEs inside JSX ternaries).
- After any Capacitor-related change, run `npm run sync` before opening Xcode/Android Studio.
- Schema changes need a new numbered `supabase-migration-*.sql` file; migrations are applied manually in the Supabase dashboard.
- Invite codes are redeemed only via the `redeem_list_invite` RPC (RLS blocks direct reads for non-members).
