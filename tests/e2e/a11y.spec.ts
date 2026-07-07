import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// axe scans in a real browser (QE framework §7): zero critical and zero
// serious violations on the public screens, both themes.

const SCREENS = ['/', '/login', '/login?mode=register', '/terms']

async function scan(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')
}

for (const path of SCREENS) {
  for (const theme of ['dark', 'light'] as const) {
    test(`${path} has no critical/serious axe violations (${theme})`, async ({ page }) => {
      await page.addInitScript(t => localStorage.setItem('listo-theme', t), theme)
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const violations = await scan(page)
      expect(
        violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)
      ).toEqual([])
    })
  }
}
