import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Sparkline } from './Sparkline'
import { DataIllustration, type DataIllustrationVariant } from './DataIllustration'

describe('Sparkline', () => {
  it('draws a polyline when there are at least 2 points', () => {
    const { container } = render(<Sparkline values={[1, 4, 2, 6]} />)
    const line = container.querySelector('polyline')
    expect(line).toBeTruthy()
    expect(line?.getAttribute('points')?.split(' ').length).toBe(4)
  })

  it('renders a spacer (no svg) when there are fewer than 2 points', () => {
    const { container } = render(<Sparkline values={[5]} />)
    expect(container.querySelector('svg')).toBeNull()
  })
})

describe('DataIllustration', () => {
  const variants: DataIllustrationVariant[] = ['device', 'browser', 'referrer', 'activity', 'sprout']
  it.each(variants)('renders a decorative svg for the %s variant', (variant) => {
    const { container } = render(<DataIllustration variant={variant} />)
    expect(container.querySelector('[aria-hidden="true"] svg, svg')).toBeTruthy()
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy()
  })
})
