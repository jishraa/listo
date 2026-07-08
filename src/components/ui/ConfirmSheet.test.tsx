// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConfirmSheet from './ConfirmSheet'

describe('ConfirmSheet', () => {
  it('renders title, body, and both actions in a named dialog', () => {
    render(
      <ConfirmSheet open onClose={() => {}} title="Delete this?" confirmLabel="Delete" onConfirm={() => {}}>
        Gone forever.
      </ConfirmSheet>
    )
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Delete this?')
    expect(screen.getByText('Gone forever.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('wires confirm and cancel', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(<ConfirmSheet open onClose={onClose} title="T" confirmLabel="Do it" onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Do it' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('uses primary styling when danger is off', () => {
    render(<ConfirmSheet open onClose={() => {}} title="T" confirmLabel="Continue" danger={false} onConfirm={() => {}} />)
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass('btn-primary')
  })

  it('busy state disables actions, shows a spinner, and blocks dismissal', () => {
    const onClose = vi.fn()
    const { container } = render(
      <ConfirmSheet open onClose={onClose} title="T" confirmLabel="Delete" busy onConfirm={() => {}} />
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(container.querySelector('.spinner')).not.toBeNull()
    fireEvent.click(container.querySelector('.sheet-overlay')!)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('surfaces errors as an alert', () => {
    render(<ConfirmSheet open onClose={() => {}} title="T" confirmLabel="Retry" error="It broke" onConfirm={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('It broke')
  })

  it('renders the centered icon variant', () => {
    render(
      <ConfirmSheet open onClose={() => {}} title="T" confirmLabel="Go" icon={<svg data-testid="ico" />} onConfirm={() => {}} />
    )
    expect(screen.getByTestId('ico')).toBeInTheDocument()
  })
})
