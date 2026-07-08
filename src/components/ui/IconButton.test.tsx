// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import IconButton from './IconButton'

describe('IconButton', () => {
  it('has the accessible name and fires clicks', () => {
    const onClick = vi.fn()
    render(<IconButton label="Close panel" onClick={onClick}><svg /></IconButton>)
    const btn = screen.getByRole('button', { name: 'Close panel' })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('respects disabled', () => {
    const onClick = vi.fn()
    render(<IconButton label="X" disabled onClick={onClick}><svg /></IconButton>)
    fireEvent.click(screen.getByRole('button', { name: 'X' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
