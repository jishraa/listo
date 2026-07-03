# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Listo — Smart Lists for Everyday Life** is a collaborative list PWA (grocery/shopping, tasks, personal lists) built with React 19 + TypeScript + Vite, deployed to web via Cloudflare Pages and to iOS/Android via Capacitor. Product vision and roadmap live in `docs/VISION.md` — consult it before proposing features; every feature must serve one of the UX goals there (save time/money/effort, improve planning, collaborate better, better decisions).

## Development Commands

```bash
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build — must pass before pushing
npm run lint       # oxlint (not eslint)
npm run deploy     # build + wrangler pages deploy (Cloudflare)
npm run sync       # build + cap sync (after Capacitor-related changes)
npm run open:ios / open:android
```

No test suite.

## Architecture

### Routes (`src/App.tsx`)

| Path | Page | Notes |
|---|---|---|
| `/login` | Login | Supabase auth; supports anonymous "guest" sign-in |
| `/join/:code` | JoinList | Invite-link landing (no auth guard) |
| `/` | Home | List overview |
| `/list/:id` | ListDetail | Items, members, share |
| `/profile` | Profile | Account, inline Settings (appearance), sign out |

Authed routes are wrapped in `AuthGuard` (redirects to `/login`). No lazy loading, no shared layout shell — each page renders its own header. Target navigation per vision: Home / Lists / + / Insights / Profile bottom bar (not yet built).

### Stores (`src/store/`) — zustand

| Store | Purpose |
|---|---|
| `useAuthStore` | Session, user, `displayName`, `isGuest` (Supabase anonymous auth), signOut |
| `useListsStore` | Lists, items, members; Supabase CRUD + realtime; templates (`saveAsTemplate`/`createFromTemplate`) and archiving (`setArchived`) |
| `useThemeStore` | `pref: 'light' \| 'dark' \| 'system'`; `applyTheme()` sets `data-theme` on `<html>` |

Go through store helpers for Supabase access; don't call Supabase directly from components.

### Supabase (`supabase-migration.sql` + `-v2.sql` + `-v3.sql`)

Tables: `lists` (name, type, emoji, owner_id, invite_code, invite_expires_at, is_template, archived_at), `list_items` (title, quantity, completed, category, sort_order, added_by_name, completed_by_name), `list_members` (list_id, user_id, role owner|collaborator, display_name).

Templates and archived lists are regular `lists` rows flagged by `is_template` / `archived_at` — no separate tables. Every "normal" list view must filter through the store's exported helpers `visibleLists` / `templateLists` / `archivedLists` (rows loaded before migration v3 lack the columns, so the helpers use truthiness, never `=== false`).

RPCs (SECURITY DEFINER): `redeem_list_invite(code, display_name)` — validates code + expiry, inserts membership; raises `invalid_code` / `expired_code` / `own_list` / `already_member`. `remove_list_member` — owner only.

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
