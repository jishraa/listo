# Listo — Smart Lists for Everyday Life

A collaborative list PWA for groceries, tasks, and everyday planning. Built with React 19 + TypeScript + Vite, backed by Supabase, deployed to web via Cloudflare Pages and to iOS/Android via Capacitor.

## Features

- **Smart Lists** — grocery, task, and personal lists with smart-input parsing (`Milk ×2`, `Rice 2kg`) and auto-categorization
- **Real-time collaboration** — invite-link sharing (owner / collaborator / viewer roles), realtime sync via Supabase, member management
- **List Memory** — per-user purchase history powers "Your regulars" and quantity-aware type-ahead suggestions when adding items
- **Duplicate detection** — flags likely-duplicate items while typing
- **Templates & archiving** — save any list as a reusable template; archive completed lists without deleting them
- **Per-list Insights** — shopping stats and trends surfaced from the list's overflow menu
- **Reports** — export a list to PDF or CSV
- **Offline support** — item-level writes queue while offline and replay in order on reconnect; installable as a PWA
- **Guest access** — anonymous sign-in scoped to joining a shared list via `/join/:code`
- **Cross-platform** — web (Cloudflare Worker, static assets) plus native iOS/Android shells via Capacitor

See [`docs/VISION.md`](docs/VISION.md) for the full product vision and roadmap.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, React Router, Zustand
- **Backend:** Supabase (Postgres, Auth, Realtime, RLS, RPCs)
- **Native:** Capacitor (iOS / Android)
- **Testing:** Vitest + Testing Library + axe-core (unit/component), Playwright (E2E + visual + Lighthouse CI)
- **Tooling:** oxlint, Cloudflare Workers (`wrangler`)

## Getting Started

```bash
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev             # dev server, points at the staging database by default
```

### Common commands

```bash
npm run dev         # Vite dev server against the STAGING database (safe default)
npm run dev:prod    # dev server against the production database (real-data repros only)
npm run verify       # full quality gate: lint → tests+coverage → build → bundle budget
npm run build        # tsc -b && vite build
npm run lint          # oxlint
npm test              # vitest — unit + component tests
npm run test:e2e     # Playwright E2E
npm run deploy        # verify + wrangler deploy (staging first, see TESTING.md)
npm run sync          # build + cap sync (after Capacitor-related changes)
npm run open:ios / open:android
```

`npm run verify` must pass before pushing; CI runs the same gate on every push/PR.

## Project Structure

```
src/
  pages/         top-level routes (Lists, ListDetail, Profile, Login, ...)
  features/      feature-scoped modules (list-detail, lists, insights)
  components/    shared UI (layout, lists, ui primitives)
  store/         zustand stores (auth, lists, categories, memory, sync, theme)
  lib/           domain logic + api/ (Supabase IO layer)
  types/         shared TypeScript types
supabase/
  migrations/    numbered schema migrations, applied in order
  RUN_MIGRATIONS.md   migration checklist
```

## Documentation

- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) — end-user guide to every feature in the app
- [`docs/TECHNICAL.md`](docs/TECHNICAL.md) — detailed technical reference with architecture diagrams
- [`CLAUDE.md`](CLAUDE.md) — architecture overview, routes, stores, Supabase schema
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — layer rules and data flow
- [`IMPLEMENTATION.md`](IMPLEMENTATION.md) — how the major features work under the hood
- [`TESTING.md`](TESTING.md) — test strategy, environments, QE roadmap
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — web/native release process, CI/CD, environments, migrations
- [`docs/VISION.md`](docs/VISION.md) — product vision and roadmap
- [`docs/AUTH.md`](docs/AUTH.md) — authentication flows
- [`supabase/RUN_MIGRATIONS.md`](supabase/RUN_MIGRATIONS.md) — schema migration checklist

## Deployment

Deployed as a Cloudflare Worker serving static assets, with an isolated staging environment so tests never touch production data (see [`TESTING.md`](TESTING.md) § Environments). Schema changes ship as a new numbered file in `supabase/migrations/`, applied to staging first, then production.
