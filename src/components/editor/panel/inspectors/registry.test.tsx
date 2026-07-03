import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { getInspector } from './registry'

describe('inspector registry', () => {
  it('falls back to DefaultInspector for an unmapped type', () => {
    const Inspector = getInspector('table')
    render(<Inspector element={{ id: 'e1', type: 'table' }} onChange={() => {}} isPro={false} />)
    expect(screen.getByText(/settings for this element/i)).toBeInTheDocument()
  })
})
