import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PublicProductListElement } from './PublicProductListElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (products: any[]): CanvasElement => ({ id: 'e1', type: 'product-list', products } as CanvasElement)

describe('PublicProductListElement', () => {
  it('renders a safe buy link in a new tab', () => {
    render(<PublicProductListElement element={el([{ id: 'p1', title: 'Mug', buyUrl: 'https://shop.example.com/mug', imageUrl: '' }])} />)
    expect(screen.getByText('Mug')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /view/i })
    expect(link).toHaveAttribute('href', 'https://shop.example.com/mug')
    expect(link).toHaveAttribute('target', '_blank')
  })
  it('drops an unsafe buy url (no link rendered)', () => {
    render(<PublicProductListElement element={el([{ id: 'p2', title: 'Bad', buyUrl: 'javascript:alert(1)' }])} />)
    expect(screen.queryByRole('link')).toBeNull()
  })
  it('shows empty state', () => {
    render(<PublicProductListElement element={el([])} />)
    expect(screen.getByText('No products yet.')).toBeInTheDocument()
  })
})
