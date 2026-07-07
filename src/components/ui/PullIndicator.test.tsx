// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import PullIndicator from './PullIndicator'

describe('PullIndicator', () => {
  it('renders nothing at rest', () => {
    const { container } = render(<PullIndicator pullY={0} isRefreshing={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the pull affordance while dragging and a spinner while refreshing', () => {
    const dragging = render(<PullIndicator pullY={40} isRefreshing={false} />)
    expect(dragging.container.querySelector('.spinner')).toBeNull()
    expect(dragging.container.firstChild).not.toBeNull()

    const refreshing = render(<PullIndicator pullY={0} isRefreshing />)
    expect(refreshing.container.querySelector('.spinner')).not.toBeNull()
  })
})
