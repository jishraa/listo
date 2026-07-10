import { defineConfig } from 'vitest/config'

// Isolated from vite.config (no PWA/react plugins needed). Two kinds of tests:
// - src/**/*.test.ts   — pure logic, node environment (default below)
// - src/**/*.test.tsx  — component tests; each declares jsdom via the
//   `// @vitest-environment jsdom` docblock at the top of the file.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Gate coverage where the tests live today (pure logic + shared UI
      // primitives); widen as layers grow. Store/page coverage comes from
      // integration/E2E layers, not line thresholds.
      include: ['src/lib/**/*.ts', 'src/components/ui/**/*.tsx', 'src/components/ErrorBoundary.tsx'],
      // lib/api is thin IO (mocked in unit tests, exercised by E2E) — like
      // supabase.ts it stays outside the line-coverage gate.
      exclude: ['src/lib/supabase.ts', 'src/lib/api/**', 'src/lib/report.ts', 'src/lib/insightsReport.ts', 'src/lib/yft.ts', 'src/lib/version.ts', 'src/**/*.test.*'],
      // Quality gate (QE framework): the covered surface must stay ≥90% lines.
      thresholds: { lines: 90, statements: 90, branches: 85, functions: 85 },
    },
  },
})
