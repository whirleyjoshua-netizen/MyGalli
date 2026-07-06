import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicHubElement } from './PublicHubElement'
import type { CanvasElement } from '@/lib/types/canvas'
const el = (o: Partial<CanvasElement>): CanvasElement => ({ id: '1', type: 'hub', ...o })
describe('PublicHubElement', () => {
  it('renders a cover tile linking to the hub viewer', () => {
    render(<PublicHubElement element={el({ hubId: 'h1', hubUsername: 'josh', hubSlug: 'listing-123', hubTitleOverride: 'Listing 123' })} />)
    const link = screen.getByRole('link', { name: /listing 123/i })
    expect(link).toHaveAttribute('href', '/josh/hub/listing-123')
  })
  it('shows a "not set up" state when no hub is linked', () => {
    render(<PublicHubElement element={el({ hubId: '' })} />)
    expect(screen.getByText(/hub/i)).toBeInTheDocument()
  })
})
