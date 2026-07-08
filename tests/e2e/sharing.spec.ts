import { test, expect } from '@playwright/test'
import { signIn, createList, deleteOpenList, EMAIL, PASSWORD } from './helpers'

// Collaboration journey (QE framework §5): owner shares a list via the invite
// link; a second account joins through it, adds an item, and the owner sees it
// arrive in realtime. Two isolated browser contexts = two devices.

const EMAIL_2 = process.env.E2E_EMAIL_2
const PASSWORD_2 = process.env.E2E_PASSWORD_2

test.describe('sharing & realtime', () => {
  test.skip(!EMAIL || !PASSWORD || !EMAIL_2 || !PASSWORD_2, 'both E2E accounts must be configured')
  test.slow()

  test('share link → second account joins → realtime edit → owner cleanup', async ({ browser }) => {
    const listName = `E2E Shared ${Date.now()}`

    // ── Owner (account 1) creates and shares ──
    const ownerCtx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
    const owner = await ownerCtx.newPage()
    await signIn(owner)
    await createList(owner, listName)
    await owner.getByText(listName).click()

    await owner.getByRole('button', { name: 'List options' }).click()
    await owner.getByRole('button', { name: 'Share', exact: true }).click()
    const shareDialog = owner.getByRole('dialog', { name: 'Share list' })
    // Wait for the link to be ready, then copy — the join URL rides along
    await expect(shareDialog.getByText(/Anyone with this link/)).toBeVisible({ timeout: 15_000 })
    await shareDialog.getByRole('button', { name: 'Copy invite link' }).click()
    const copied = await owner.evaluate(() => navigator.clipboard.readText())
    const joinUrl = copied.match(/https?:\/\/[^\s]+\/join\/[a-z0-9]+/)?.[0]
    expect(joinUrl, `no join link in copied text: ${copied}`).toBeTruthy()
    await owner.keyboard.press('Escape') // close share sheet, stay on the list

    // ── Second account joins via the link ──
    const guestCtx = await browser.newContext()
    const member = await guestCtx.newPage()
    await member.goto(joinUrl!)
    await expect(member.getByText("You've been invited to join")).toBeVisible({ timeout: 15_000 })
    await expect(member.getByText(listName)).toBeVisible()
    await member.getByRole('button', { name: 'Sign In or Create Account' }).click()
    await member.locator('#auth-email').fill(EMAIL_2!)
    await member.locator('#auth-password').fill(PASSWORD_2!)
    await member.getByRole('button', { name: 'Sign In', exact: true }).click()
    // Auth resumes the join; confirm membership
    await member.getByRole('button', { name: 'Join List' }).click()
    await expect(member).toHaveURL(/\/list\//, { timeout: 15_000 })
    await expect(member.getByText(listName)).toBeVisible()

    // ── Member adds an item; owner sees it in realtime ──
    await member.getByRole('button', { name: 'Add item', exact: true }).click()
    const input = member.getByRole('textbox', { name: `Add item to ${listName}` })
    await input.fill('Sugar')
    await input.press('Enter')
    await expect(member.getByText(/Sugar added/)).toBeVisible()

    await expect(owner.getByText('Sugar', { exact: true })).toBeVisible({ timeout: 20_000 })
    // Membership isn't pushed in realtime (items only) — a refresh shows the
    // member roster ("You, <member>") on the owner's side.
    await owner.reload()
    await expect(owner.getByText(/You, /)).toBeVisible({ timeout: 15_000 })
    await expect(owner.getByText('Sugar', { exact: true })).toBeVisible({ timeout: 15_000 })

    // ── Cleanup: owner deletes the list for everyone ──
    await deleteOpenList(owner)

    await ownerCtx.close()
    await guestCtx.close()
  })
})
