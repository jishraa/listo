# Listo — Quality Engineering

Every layer must pass before deployment. `npm run deploy` refuses to ship
unless the full local gate passes; CI runs the same gate on every push/PR.

## Commands

| Command | What |
|---|---|
| `npm run verify` | The full gate: lint → tests+coverage → build → bundle budget |
| `npm run lint` | oxlint static analysis |
| `npm run typecheck` | `tsc -b` |
| `npm test` | vitest (unit + component) |
| `npm run test:coverage` | tests + coverage thresholds (≥90% lines on gated files) |
| `npm run check:bundle` | initial-JS gzip budget (≤300 KB) against `dist/` |

## Test layers (testing pyramid)

**Static analysis** — oxlint + TypeScript strict build. Runs first in CI.

**Unit tests** (`src/lib/*.test.ts`, node env) — pure logic:
smart-input parsing (`parseItemInput`), category matching
(`detectCategoryIn`, whole-word + longest-keyword-wins), list-type
suggestion, duplicate detection, List Memory suggestions, quantity/name/date
formatting, password policy.

**Component tests** (`src/**/*.test.tsx`, jsdom via the
`// @vitest-environment jsdom` docblock) — React Testing Library against the
shared primitives: `Sheet` (dialog semantics, Escape stack, backdrop,
back/close affordances), `ErrorBoundary` (crash → recovery card),
`PullIndicator`. Include an axe-core scan (`axe.run`) for a11y violations;
`color-contrast` is disabled in jsdom (no canvas) — contrast is enforced by
the AA-audited tokens in `index.css`.

**Coverage gate** — thresholds live in `vitest.config.ts` and apply to the
covered surface (`src/lib`, shared UI primitives): 90% lines/statements,
85% branches/functions. Widen `coverage.include` as new layers gain tests —
don't lower the thresholds.

**Bundle budget** — `scripts/check-bundle-size.mjs` gzips the chunks
referenced from `dist/index.html` (entry + modulepreloads). Initial JS must
stay ≤300 KB gzip (currently ~158 KB). Lazy chunks are reported, not gated.

**E2E (Playwright, `tests/e2e/`)** — runs against the production build
(`vite preview`), locally and in CI:
- `public.spec.ts` — unauthenticated journeys: landing, login validation,
  register rules, forgot-password, invalid invite links, legal pages,
  redirects and route guards.
- `auth-journey.spec.ts` — the critical flow against real Supabase with the
  dedicated E2E account (`E2E_EMAIL`/`E2E_PASSWORD`, in `.env` locally and
  repo secrets in CI): login → create list → smart-parse adds → complete →
  rename → delete → sign out. Self-cleaning; skips when unconfigured.
- `a11y.spec.ts` — axe-core in a real browser: zero critical/serious
  violations on public screens, both themes (includes color-contrast).
- `responsive.spec.ts` — no horizontal overflow at 320–768px.
- `visual.spec.ts` — screenshot baselines (light/dark × mobile/desktop).
  Platform-specific, so **local-only for now** (auto-skips on CI);
  regenerate intentionally with `npm run test:visual:update`.

Commands: `npm run test:e2e` (headless) / `npm run test:e2e:ui` (debug UI).

## CI

`.github/workflows/ci.yml`, on every push to `main` and every PR:
1. **quality** — install → lint → typecheck → test+coverage → build →
   bundle budget. No secrets needed.
2. **e2e** (after quality) — Playwright chromium against the built app,
   using the `VITE_SUPABASE_*` and `E2E_*` repo secrets; uploads the HTML
   report as an artifact on failure.

## Conventions

- Colocate tests next to the code (`foo.ts` → `foo.test.ts`); `tests/e2e/`
  is reserved for Playwright when it lands.
- Logic tests default to the node environment; component tests opt into
  jsdom with the docblock.
- Component tests must never import anything that pulls in
  `src/lib/supabase.ts` (it throws without env vars — and tests shouldn't
  touch the network anyway). Store-dependent behavior belongs to the
  integration/E2E layers.

## Roadmap (not yet implemented)

- **Visual regression in CI** — generate linux baselines (docker or a
  one-off CI update run) so `visual.spec.ts` stops skipping on CI; or move
  to Percy/Chromatic if a review UI is wanted.
- **More E2E journeys** — sharing/invite redemption (needs a second test
  account), Shop Mode, offline queue replay (network interception),
  PWA install prompt + SW update toast.
- **Performance** — Lighthouse CI against the deployed preview (LCP/CLS/INP,
  score ≥95 gate).
