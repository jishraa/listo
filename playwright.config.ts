import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Local env loading, first file wins: .env.staging (the E2E target) over
// .env (production). CI provides real env vars and has neither file.
for (const file of ['./.env.staging', './.env']) {
  try {
    for (const line of readFileSync(new URL(file, import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  } catch { /* file absent — fine */ }
}

// E2E against a production-mode build (vite preview) pointed at the STAGING
// Supabase project — tests never touch production data. Locally the staging
// values come from .env.staging; CI injects them via repository secrets.
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
    // --mode staging loads .env.staging over .env locally; in CI the
    // process-level VITE_SUPABASE_* (staging secrets) win regardless.
    command: 'npm run build:staging && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
