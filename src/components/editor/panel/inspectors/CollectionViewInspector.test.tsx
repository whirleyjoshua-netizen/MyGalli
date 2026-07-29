import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CollectionViewInspector } from './CollectionViewInspector'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1', type: 'collection-view',
  collectionColumns: 3,
  ...over,
} as CanvasElement)

const setup = (over: Partial<CanvasElement> = {}) => {
  const onChange = vi.fn()
  render(<CollectionViewInspector element={el(over)} onChange={onChange} isPro={false} />)
  return onChange
}

describe('CollectionViewInspector', () => {
  it('sets columns → collectionColumns as a number', () => {
    const onChange = setup()
    fireEvent.click(screen.getByRole('button', { name: /^4$/ }))
    expect(onChange).toHaveBeenCalledWith({ collectionColumns: 4 })
  })

  it('marks the active column count', () => {
    setup({ collectionColumns: 2 })
    expect(screen.getByRole('button', { name: /^2$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^3$/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('defaults to 3 columns when unset', () => {
    setup({ collectionColumns: undefined })
    expect(screen.getByRole('button', { name: /^3$/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('points at the card for choosing which pages appear', () => {
    setup()
    expect(screen.getByText(/manage pages.*on the card/i)).toBeInTheDocument()
  })
})
