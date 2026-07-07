import { test, expect } from '@playwright/test'

// Unauthenticated journeys — no test account needed.

test.describe('landing & routing', () => {
  test('signed-out "/" shows the marketing landing with a signup CTA', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Lists that get/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Get Started/i }).first()).toBeVisible()
  })

  test('legacy routes redirect to root', async ({ page }) => {
    await page.goto('/lists')
    await expect(page).toHaveURL('/')
    await page.goto('/insights')
    await expect(page).toHaveURL('/')
  })

  test('signed-out /profile redirects to login', async ({ page }) => {
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unknown routes land on root', async ({ page }) => {
    await page.goto('/definitely-not-a-page')
    await expect(page).toHaveURL('/')
  })
})

test.describe('login screen', () => {
  test('renders sign-in with social options and validates inline', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with Apple' })).toBeVisible()

    // Inline validation, never browser-native popups
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('email')
    await page.locator('#auth-email').fill('not-an-email')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('valid email')
  })

  test('register mode shows password rules and legal links', async ({ page }) => {
    await page.goto('/login?mode=register')
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
    await page.locator('#auth-password').fill('abc')
    await expect(page.getByText('Minimum 8 characters')).toBeVisible()
    await expect(page.getByText('One uppercase letter')).toBeVisible()

    await page.getByRole('link', { name: 'Terms of Service' }).click()
    await expect(page.getByText('Welcome to Listo.')).toBeVisible()
  })

  test('forgot-password flow is reachable and validates', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
    await page.getByRole('button', { name: 'Send Reset Link' }).click()
    await expect(page.getByRole('alert')).toContainText('email')
    // Standard back affordance returns to sign-in
    await page.getByRole('button', { name: 'Back to sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  })
})

test.describe('invite links', () => {
  test('malformed code shows the not-found state with a way out', async ({ page }) => {
    await page.goto('/join/NOT-A-REAL-CODE!!!')
    await expect(page.getByText('Link not found')).toBeVisible()
    await page.getByRole('button', { name: 'Go Home' }).click()
    await expect(page).toHaveURL('/')
  })
})

test.describe('legal pages', () => {
  test('terms and privacy render without auth', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.getByText('Terms of Service')).toBeVisible()
    await page.goto('/privacy')
    await expect(page.getByText('Privacy Policy')).toBeVisible()
    await expect(page.getByText(/Delete Account/)).toBeVisible()
  })
})
