import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Load .env for local runs (E2E_EMAIL / E2E_PASSWORD); CI provides real env.
try {
  for (const line of readFileSync(new URL('./.env', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch { /* no .env — fine in CI */ }

// E2E against the production build (vite preview). Locally the app uses the
// real .env Supabase project; CI injects the same via repository secrets.
// The auth journey signs in with the dedicated E2E test account
// (E2E_EMAIL / E2E_PASSWORD) and cleans up everything it creates.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false, // small suite; the auth journey mutates one account
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  expect: {
    // Visual snapshots: small anti-aliasing tolerance
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
