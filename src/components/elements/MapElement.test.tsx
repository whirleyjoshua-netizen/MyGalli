import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MapElement } from './MapElement'
import type { CanvasElement } from '@/lib/types/canvas'

const base: CanvasElement = { id: '1', type: 'map', mapPlaces: [], mapCategories: [{ key: 'visited', label: 'Visited', color: '#39D98A' }] }

describe('MapElement editor', () => {
  it('renders the title input and reports title changes', () => {
    const onChange = vi.fn()
    render(<MapElement element={base} onChange={onChange} onDelete={() => {}} isSelected onSelect={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('Map title'), { target: { value: 'My travels' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mapTitle: 'My travels' }))
  })

  it('adds a category', () => {
    const onChange = vi.fn()
    render(<MapElement element={base} onChange={onChange} onDelete={() => {}} isSelected onSelect={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add category/i }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      mapCategories: expect.arrayContaining([expect.objectContaining({ key: 'visited' })]),
    }))
    const lastCall = onChange.mock.calls.at(-1)![0]
    expect(lastCall.mapCategories.length).toBe(2)
  })
})
