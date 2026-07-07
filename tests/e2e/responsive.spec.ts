import { test, expect } from '@playwright/test'

// No horizontal scrolling at any supported width (QE framework §8).
// Functional assertion instead of screenshots — platform-independent, CI-safe.

const WIDTHS = [320, 360, 375, 390, 414, 768]
const PAGES = ['/', '/login', '/login?mode=register', '/join/badcode123', '/terms']

for (const width of WIDTHS) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    for (const path of PAGES) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
      expect(overflow, `${path} overflows horizontally at ${width}px`).toBeLessThanOrEqual(0)
    }
  })
}
