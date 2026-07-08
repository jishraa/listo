// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import Avatar, { avatarHue } from './Avatar'

describe('Avatar', () => {
  it('shows the uppercased initial', () => {
    const { container } = render(<Avatar name="anjana" />)
    expect(container).toHaveTextContent('A')
  })

  it('is deterministic — the same name always gets the same hue', () => {
    expect(avatarHue('Anjana')).toBe(avatarHue('Anjana'))
    expect(avatarHue('Anjana')).not.toBe(avatarHue('Ravi'))
  })

  it('handles empty names without crashing', () => {
    const { container } = render(<Avatar name="" />)
    expect(container.firstChild).not.toBeNull()
  })
})
