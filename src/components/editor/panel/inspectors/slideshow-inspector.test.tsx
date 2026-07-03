import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { getInspector } from './registry'

const el = { id: 'e', type: 'slideshow' as const, slideshowSlides: [], slideshowHeight: 400, slideshowShowOverlay: true }

describe('SlideshowInspector', () => {
  it('edits the height (basic, free)', () => {
    const onChange = vi.fn()
    const Inspector = getInspector('slideshow')
    render(<Inspector element={el} onChange={onChange} isPro={false} />)
    fireEvent.change(screen.getByLabelText(/height/i), { target: { value: '500' } })
    expect(onChange).toHaveBeenCalledWith({ slideshowHeight: 500 })
  })
  it('shows a Pro lock in Advanced for free users', () => {
    const Inspector = getInspector('slideshow')
    render(<Inspector element={el} onChange={() => {}} isPro={false} />)
    expect(screen.getByText(/advanced/i)).toBeInTheDocument()
    expect(screen.getByText(/pro/i)).toBeInTheDocument()
  })
  it('shows the rotation home (no lock) for Pro users', () => {
    const Inspector = getInspector('slideshow')
    render(<Inspector element={el} onChange={() => {}} isPro />)
    expect(screen.getByText(/auto-rotation/i)).toBeInTheDocument()
  })
})
