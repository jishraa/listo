import { test, expect } from '@playwright/test'
import { signIn, createList, deleteOpenList, EMAIL, PASSWORD } from './helpers'

// Offline-first behavior (QE framework §10/§17): item writes made with no
// network are applied optimistically, surfaced in the status pill, queued,
// and replayed to the server on reconnect. Self-cleaning.

test.describe('offline queue', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_EMAIL / E2E_PASSWORD not configured')
  test.slow()

  test('adds queue offline, replay on reconnect, and persist server-side', async ({ page, context }) => {
    const listName = `E2E Queue ${Date.now()}`
    await signIn(page)
    await createList(page, listName)
    await page.getByText(listName).click()
    await page.getByRole('button', { name: 'Add item', exact: true }).click()
    const input = page.getByRole('textbox', { name: `Add item to ${listName}` })

    // ── Go offline and add ──
    await context.setOffline(true)
    await input.fill('Bananas')
    await input.press('Enter')
    // Optimistic row + honest status pill
    await expect(page.getByText(/Bananas added/)).toBeVisible()
    await expect(page.getByText("Offline · 1 pending")).toBeVisible()

    await input.fill('Coffee')
    await input.press('Enter')
    await expect(page.getByText("Offline · 2 pending")).toBeVisible()
    await page.keyboard.press('Escape')

    // Both rows exist locally while offline
    await expect(page.getByText('Bananas', { exact: true })).toBeVisible()
    await expect(page.getByText('Coffee', { exact: true })).toBeVisible()

    // ── Reconnect: queue flushes, pill clears ──
    await context.setOffline(false)
    await expect(page.getByText(/Offline ·/)).not.toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Syncing/)).not.toBeVisible({ timeout: 15_000 })

    // ── Server truth: a fresh load still has both items ──
    await page.reload()
    await expect(page.getByText('Bananas', { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Coffee', { exact: true })).toBeVisible()
    await expect(page.getByText('2 items left')).toBeVisible()

    await deleteOpenList(page)
  })
})
