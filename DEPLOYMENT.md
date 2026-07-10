# Listo — Deployment

How Listo ships to web and to native app stores, and the environments that
back each one. See [`TESTING.md`](TESTING.md) § Environments for how tests
map to these same environments.

## Web (Cloudflare Workers)

Listo is a **static-assets Worker** — there's no server-side runtime, just
the built `dist/` served with SPA fallback (`wrangler.jsonc`,
`not_found_handling: single-page-application`, so client-side routes like
`/list/:id` and `/join/:code` resolve correctly on a hard refresh).

| | Production | Staging |
|---|---|---|
| Worker | `listo` → listo.grk766.workers.dev | `listo-staging` → listo-staging.grk766.workers.dev |
| Supabase project | `listo` | `Listo Staging` (separate account — isolated data) |
| Build command | `npm run build` | `npm run build:staging` (`vite build --mode staging`) |
| Deploy command | `npm run deploy` | `npm run deploy:staging` |
| Env source | `.env` | `.env.staging` (gitignored) |

`wrangler.jsonc` defines the `staging` environment block separately from the
top-level (default/production) config — **wrangler environments don't
inherit bindings**, so the `assets` block is repeated rather than shared.

### Deploy gate

`npm run deploy` = `npm run verify && wrangler deploy`. `verify` is
lint → tests+coverage → build → bundle budget — **a failing gate blocks the
deploy**, there is no `--force`/skip path. `deploy:staging` builds in
staging mode and deploys to the staging Worker without running the full
gate (staging is the rehearsal environment; iterate there freely, then run
the full `npm run deploy` gate for production).

### Release order

1. Land the change on `main`.
2. If it includes a schema change: apply the new
   `supabase/migrations/supabase-migration-vN.sql` to the **Listo Staging**
   Supabase project first (SQL Editor — see
   [`supabase/RUN_MIGRATIONS.md`](supabase/RUN_MIGRATIONS.md)).
3. `npm run deploy:staging`, confirm E2E passes against staging
   (`npm run test:e2e` targets staging by default via `.env.staging`).
4. Apply the same migration to the **production** Supabase project.
5. `npm run deploy` (runs the full local gate, then deploys to the
   production Worker).

Staging's free-tier Supabase project pauses after ~1 week idle — the first
deploy/test run after a pause fails until it's restored from the Supabase
dashboard.

## CI/CD

`.github/workflows/ci.yml` runs on every push to `main` and every PR:

1. **quality** — install → oxlint → `tsc -b` → `test:coverage` → `build` →
   bundle budget. No secrets required.
2. **e2e** (after `quality`) — Playwright (chromium) against the production
   build, using `VITE_SUPABASE_*` and `E2E_*` repo secrets; uploads the HTML
   report as an artifact on failure. Visual snapshots auto-skip on CI until
   linux baselines exist.
3. **perf** (after `quality`) — Lighthouse CI (`lighthouserc.json`) against
   `/` and `/login`: performance ≥90, accessibility ≥95, best-practices ≥90.

CI does **not** deploy — deploys are run locally (`npm run deploy` /
`deploy:staging`) so a human always triggers the production release.

## Environment variables

| Var | Used by | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | app + Playwright | production values in `.env`, staging values in `.env.staging` |
| `STAGING_SUPABASE_*` | CI | GitHub Actions repo secrets, mirrors `.env.staging` for the `e2e` job |
| `E2E_EMAIL` / `E2E_PASSWORD`, `E2E_EMAIL_2` / `E2E_PASSWORD_2` | Playwright | dedicated staging-only accounts for the auth-journey and sharing specs; suites self-skip when unconfigured |

Never commit real values — `.env`, `.env.staging`, and
`supabase/staging-setup-combined.sql` are gitignored.

## Native apps (Capacitor)

`ios/` and `android/` are native shells wrapping the same web build
(`capacitor.config.ts`: `webDir: dist`, appId `app.listo.lists`).

```bash
npm run sync          # build + npx cap sync — run after ANY Capacitor-related change
npm run open:ios      # open the Xcode project
npm run open:android  # open the Android Studio project
```

Store submission (App Store / Play Console) is a manual step from each IDE —
not automated in CI. Bump `version` in `package.json` and the native
project's version/build number together before submitting.

## Schema migrations

Numbered, forward-only SQL files in `supabase/migrations/`, applied manually
via the Supabase dashboard SQL Editor — **staging first, then production**
(never the reverse). Each migration is idempotent (`if not exists` /
`create or replace`) so re-running is safe. Client code must tolerate the
*previous* schema until the migration has been applied everywhere (see the
PGRST204 fallbacks in `lib/api/items.ts`) — a deploy can land before its
matching migration is applied, but not the other way around.

See [`supabase/RUN_MIGRATIONS.md`](supabase/RUN_MIGRATIONS.md) for the
full, ordered checklist of what each migration adds and what breaks without
it.

## Rollback

There is no automated rollback. To revert a bad web deploy: `wrangler
deployments list` / `wrangler rollback` for the affected Worker (`listo` or
`listo-staging`), or redeploy a previous commit via `npm run deploy` after
`git revert`. Schema migrations are forward-only — a bad migration is fixed
with a new corrective migration, not by editing/deleting the old file.
