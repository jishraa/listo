// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import axe from 'axe-core'
import Sheet from './Sheet'

// Container-scoped axe run; page-level rules (region/landmarks) and
// color-contrast (needs a real canvas) don't apply in jsdom.
async function expectNoAxeViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
  })
  expect(results.violations).toEqual([])
}

describe('Sheet', () => {
  it('renders nothing while closed', () => {
    render(<Sheet open={false} onClose={() => {}} title="Hidden"><p>body</p></Sheet>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders an accessible modal dialog with title and close button', async () => {
    const { container } = render(
      <Sheet open onClose={() => {}} title="Options" subtitle="Pick one"><p>body</p></Sheet>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('Options')
    expect(screen.getByText('Pick one')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    await expectNoAxeViolations(container)
  })

  it('uses ariaLabel as the accessible name for title-less sheets', () => {
    render(<Sheet open onClose={() => {}} ariaLabel="Delete list"><p>sure?</p></Sheet>)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Delete list')
    // No header without a title — content only
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })

  it('closes on the close button and on backdrop click', () => {
    const onClose = vi.fn()
    const { container } = render(<Sheet open onClose={onClose} title="T"><p>b</p></Sheet>)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(container.querySelector('.sheet-overlay')!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<Sheet open onClose={onClose} title="T"><p>b</p></Sheet>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape only closes the topmost of nested sheets', () => {
    const closeOuter = vi.fn()
    const closeInner = vi.fn()
    render(
      <>
        <Sheet open onClose={closeOuter} title="Outer"><p>o</p></Sheet>
        <Sheet open onClose={closeInner} title="Inner"><p>i</p></Sheet>
      </>
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(closeInner).toHaveBeenCalledTimes(1)
    expect(closeOuter).not.toHaveBeenCalled()
  })

  it('shows the back affordance only when onBack is provided', () => {
    const onBack = vi.fn()
    render(<Sheet open onClose={() => {}} onBack={onBack} title="Step 2"><p>b</p></Sheet>)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
