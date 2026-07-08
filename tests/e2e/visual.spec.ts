import { test, expect } from '@playwright/test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Visual regression (QE framework §6) — Playwright snapshots, both themes,
// mobile + desktop. Baselines are platform-specific (font rendering): the
// suite gates on CI automatically once linux baselines are committed
// (generate them with the "Update visual baselines" workflow), and
// UPDATE_VISUAL=1 forces a run for that workflow's --update-snapshots pass.
const linuxBaselines = existsSync(
  fileURLToPath(new URL('./visual.spec.ts-snapshots/landing-dark-desktop-linux.png', import.meta.url))
)
test.skip(
  !!process.env.CI && !linuxBaselines && !process.env.UPDATE_VISUAL,
  'no linux baselines yet — run the "Update visual baselines" workflow'
)

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
