import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlashCommandMenu } from './SlashCommandMenu'

// jsdom doesn't implement scrollIntoView; the menu calls it on selection changes.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

const props = { position: { x: 0, y: 0 }, onSelect: () => {}, onClose: () => {} }

describe('SlashCommandMenu App Card gating', () => {
  it('shows "App Card" by default (e.g. in the page editor)', () => {
    render(<SlashCommandMenu {...props} />)
    expect(screen.getByText('App Card')).toBeInTheDocument()
  })

  it('hides "App Card" when hideApps is set (profile editor)', () => {
    render(<SlashCommandMenu {...props} hideApps />)
    expect(screen.queryByText('App Card')).not.toBeInTheDocument()
  })
})
