import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicMapElement } from './PublicMapElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement>): CanvasElement => ({ id: '1', type: 'map', ...over })

describe('PublicMapElement', () => {
  it('renders nothing when there are no places', () => {
    const { container } = render(<PublicMapElement element={el({ mapPlaces: [] })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the title and category legend without throwing (Leaflet not loaded in jsdom)', () => {
    render(<PublicMapElement element={el({
      mapTitle: 'My travels',
      mapPlaces: [
        { id: 'a', label: 'Lisbon', lat: 38.7, lng: -9.1, category: 'lived' },
        { id: 'b', label: 'Tokyo', lat: 35.6, lng: 139.7, category: 'seen' },
      ],
      mapCategories: [
        { key: 'lived', label: 'Lived', color: '#6C63FF' },
        { key: 'seen', label: 'Seen', color: '#1FB6FF' },
      ],
    })} />)
    expect(screen.getByText('My travels')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lived' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seen' })).toBeInTheDocument()
  })

  it('hides the legend when fewer than two categories are in use', () => {
    render(<PublicMapElement element={el({
      mapPlaces: [{ id: 'a', label: 'Lisbon', lat: 38.7, lng: -9.1, category: 'lived' }],
      mapCategories: [{ key: 'lived', label: 'Lived', color: '#6C63FF' }],
    })} />)
    expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument()
  })
})
