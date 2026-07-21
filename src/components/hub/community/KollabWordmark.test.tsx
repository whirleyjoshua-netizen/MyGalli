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

  it('wires the gradient id to the text fill attribute', () => {
    const { container } = render(<KollabWordmark />)
    const linearGradient = container.querySelector('linearGradient')
    const textElement = container.querySelector('text')

    expect(linearGradient).toBeInTheDocument()
    expect(textElement).toBeInTheDocument()

    const gradientId = linearGradient?.id
    const textFill = textElement?.getAttribute('fill')

    expect(gradientId).toBeTruthy()
    expect(textFill).toBe(`url(#${gradientId})`)
  })

  it('generates unique gradient ids across multiple instances', () => {
    const { container } = render(
      <>
        <KollabWordmark />
        <KollabWordmark />
      </>
    )
    const gradients = container.querySelectorAll('linearGradient')
    expect(gradients).toHaveLength(2)

    const id1 = gradients[0].id
    const id2 = gradients[1].id

    expect(id1).toBeTruthy()
    expect(id2).toBeTruthy()
    expect(id1).not.toBe(id2)
  })

  it('renders the Kollab brand colors in the gradient stops', () => {
    const { container } = render(<KollabWordmark />)
    const stops = container.querySelectorAll('stop')

    expect(stops).toHaveLength(2)
    expect(stops[0].getAttribute('stop-color')).toBe('#FF6B3D')
    expect(stops[1].getAttribute('stop-color')).toBe('#FF8A5B')
  })

  it('renders the correct viewBox', () => {
    const { container } = render(<KollabWordmark />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 300 78')
  })
})
