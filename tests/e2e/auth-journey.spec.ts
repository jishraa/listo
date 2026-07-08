import { test, expect } from '@playwright/test'

// The critical authenticated journey (QE framework §5), run against the real
// Supabase backend with the dedicated E2E account. Self-cleaning: everything
// it creates it deletes. Skipped when the account isn't configured.

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD

test.describe('authenticated journey', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_EMAIL / E2E_PASSWORD not configured')
  test.slow() // real network round-trips to Supabase

  test('login → create list → add/complete items → delete → sign out', async ({ page }) => {
    const listName = `E2E Groceries ${Date.now()}`

    // ── Login ──
    await page.goto('/login')
    await page.locator('#auth-email').fill(EMAIL!)
    await page.locator('#auth-password').fill(PASSWORD!)
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Create list', exact: true })).toBeVisible({ timeout: 15_000 })

    // ── Create a blank shopping list ──
    await page.getByRole('button', { name: 'Create list', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Create Blank List' }).click()
    await page.locator('#new-list-name').fill(listName)
    await page.getByRole('dialog').getByRole('button', { name: 'Shopping', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Create List', exact: true }).click()

    // ── Open it and add items (smart parsing) ──
    await page.getByText(listName).click()
    // exact: the FAB ("Add item") vs the empty-state CTA ("Add Item")
    await page.getByRole('button', { name: 'Add item', exact: true }).click()
    const input = page.getByRole('textbox', { name: `Add item to ${listName}` })
    await input.fill('Milk 2L')
    await input.press('Enter')
    await expect(page.getByText(/Milk · 2 L added/)).toBeVisible()
    await input.fill('Eggs 12')
    await input.press('Enter')
    await expect(page.getByText(/Eggs · 12 added/)).toBeVisible()
    // Close the add sheet
    await page.keyboard.press('Escape')

    // Both items pending, parsed quantities shown
    await expect(page.getByText('Milk', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Quantity 2 L' })).toBeVisible()
    await expect(page.getByText('2 items left')).toBeVisible()

    // ── Complete one ──
    await page.getByRole('button', { name: 'Mark complete' }).first().click()
    await expect(page.getByText('1 item left')).toBeVisible()
    await expect(page.getByRole('button', { name: /Completed \(1\)/ })).toBeVisible()

    // ── Rename via List Options ──
    await page.getByRole('button', { name: 'List options' }).click()
    await page.getByRole('button', { name: 'Rename' }).click()
    const renamed = `${listName} ✓`
    const renameDialog = page.getByRole('dialog', { name: 'Rename list' })
    await renameDialog.locator('input').fill(renamed)
    await renameDialog.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText(renamed).first()).toBeVisible()

    // ── Delete the list (confirmed) ──
    await page.getByRole('button', { name: 'List options' }).click()
    await page.getByRole('button', { name: 'Delete List', exact: true }).click()
    await page.getByRole('dialog', { name: 'Delete this list?' }).getByRole('button', { name: 'Delete List' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText(renamed)).not.toBeVisible()

    // ── Sign out ──
    await page.getByRole('button', { name: 'Profile' }).click()
    await page.getByRole('button', { name: 'Sign Out', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Sign Out' }).click()
    await expect(page).toHaveURL(/\/login/)
  })
})
