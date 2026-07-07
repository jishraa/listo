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

## CI

`.github/workflows/ci.yml`: install → lint → typecheck → test+coverage →
build → bundle budget, on every push to `main` and every PR. No secrets
needed — the gated tests never touch Supabase.

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

- **E2E (Playwright)** — highest-value next layer. Unauthenticated journeys
  (landing → login validation, invalid join links, legal pages) need no
  setup; authenticated journeys (create/share/shop flows) need a dedicated
  Supabase test user + env secrets in CI.
- **Visual regression** — Playwright screenshot snapshots (free, in-repo)
  across light/dark × 320/375/768 px, or Percy/Chromatic (paid) if review
  UI is wanted.
- **Performance** — Lighthouse CI against the deployed preview (LCP/CLS/INP,
  score ≥95 gate).
- **PWA/offline** — Playwright with network interception: offline queue
  replay, install prompt, SW update toast.
