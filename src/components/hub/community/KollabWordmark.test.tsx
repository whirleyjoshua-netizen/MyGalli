import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KollabWordmark } from './KollabWordmark'

describe('KollabWordmark', () => {
  it('exposes the brand name to assistive tech', () => {
    render(<KollabWordmark />)
    expect(screen.getByRole('img', { name: 'Kollab' })).toBeInTheDocument()
  })

  it('accepts a className for sizing', () => {
    const { container } = render(<KollabWordmark className="h-8" />)
    expect(container.querySelector('svg')).toHaveClass('h-8')
  })
})
