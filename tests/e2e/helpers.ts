import { expect, type Page } from '@playwright/test'

export const EMAIL = process.env.E2E_EMAIL
export const PASSWORD = process.env.E2E_PASSWORD

// Sign in with the dedicated E2E account and wait for the Lists workspace.
export async function signIn(page: Page) {
  await page.goto('/login')
  await page.locator('#auth-email').fill(EMAIL!)
  await page.locator('#auth-password').fill(PASSWORD!)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Create list', exact: true })).toBeVisible({ timeout: 15_000 })
}

// Create a blank list of the given type and land on the Lists page.
export async function createList(page: Page, name: string, type: 'Personal' | 'Tasks' | 'Shopping' = 'Shopping') {
  await page.getByRole('button', { name: 'Create list', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Create Blank List' }).click()
  await page.locator('#new-list-name').fill(name)
  await page.getByRole('dialog').getByRole('button', { name: type, exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Create List', exact: true }).click()
  await expect(page.getByText(name)).toBeVisible()
}

// Delete the currently open list via List Options (from ListDetail).
export async function deleteOpenList(page: Page) {
  await page.getByRole('button', { name: 'List options' }).click()
  await page.getByRole('button', { name: 'Delete List', exact: true }).click()
  await page.getByRole('dialog', { name: 'Delete this list?' }).getByRole('button', { name: 'Delete List' }).click()
  await expect(page).toHaveURL('/')
}
