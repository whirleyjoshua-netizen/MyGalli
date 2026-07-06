import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicCollectionView } from './PublicCollectionView'
import type { CanvasElement } from '@/lib/types/canvas'

const base: CanvasElement = { id: 'e1', type: 'collection-view', collectionColumns: 3 }

describe('PublicCollectionView', () => {
  it('renders a card per member linking to its page', () => {
    const element: CanvasElement = {
      ...base,
      collectionMembers: [
        { id: 'm1', username: 'coach', slug: 'josh', title: 'Josh Smith', description: 'CB', coverImage: null, category: 'sports' },
        { id: 'm2', username: 'coach', slug: 'ava', title: 'Ava Lee', description: null, coverImage: null, category: null },
      ],
    }
    render(<PublicCollectionView element={element} />)
    expect(screen.getByText('Josh Smith')).toBeInTheDocument()
    expect(screen.getByText('Ava Lee')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Josh Smith/ })).toHaveAttribute('href', '/coach/josh')
  })

  it('renders an empty state when there are no members', () => {
    render(<PublicCollectionView element={{ ...base, collectionMembers: [] }} />)
    expect(screen.getByText(/no pages yet/i)).toBeInTheDocument()
  })
})
