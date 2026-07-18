import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeatureTour, TemplatesComingSoon, TipsRail } from './WorkspacesLandingSections'

describe('landing sections', () => {
  it('FeatureTour shows the four capabilities', () => {
    render(<FeatureTour />)
    expect(screen.getByText(/Define your schema/i)).toBeInTheDocument()
    expect(screen.getByText(/Add and edit data/i)).toBeInTheDocument()
    expect(screen.getByText(/View your data/i)).toBeInTheDocument()
    expect(screen.getByText(/Track live metrics/i)).toBeInTheDocument()
  })
  it('TemplatesComingSoon shows placeholder cards marked coming soon and none are links', () => {
    const { container } = render(<TemplatesComingSoon />)
    expect(screen.getAllByText(/Coming soon/i).length).toBeGreaterThanOrEqual(1)
    expect(container.querySelectorAll('a').length).toBe(0) // non-interactive
  })
  it('TipsRail renders tips', () => {
    render(<TipsRail />)
    expect(screen.getByText(/tips/i)).toBeInTheDocument()
  })
})
