import { test, expect } from '@playwright/test'

// Visual regression (QE framework §6) — Playwright snapshots, both themes,
// mobile + desktop. Baselines are platform-specific (font rendering), so this
// suite runs locally only until linux baselines are generated for CI.
test.skip(!!process.env.CI, 'visual baselines are local (darwin) for now')

const SHOTS: { name: string; path: string }[] = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'register', path: '/login?mode=register' },
]

for (const { name, path } of SHOTS) {
  for (const theme of ['dark', 'light'] as const) {
    for (const [device, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]] as const) {
      test(`${name} — ${theme} ${device}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await page.addInitScript(t => localStorage.setItem('listo-theme', t), theme)
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await expect(page).toHaveScreenshot(`${name}-${theme}-${device}.png`, { fullPage: false })
      })
    }
  }
}
