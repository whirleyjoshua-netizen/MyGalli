import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RatingInspector } from './RatingInspector'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1', type: 'rating',
  ratingQuestion: 'How would you rate this?',
  ratingMax: 5,
  ratingStyle: 'stars',
  ratingRequired: false,
  ...over,
} as CanvasElement)

const setup = (over: Partial<CanvasElement> = {}) => {
  const onChange = vi.fn()
  render(<RatingInspector element={el(over)} onChange={onChange} isPro={false} />)
  return onChange
}

describe('RatingInspector', () => {
  it('edits question → ratingQuestion', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/question/i), { target: { value: 'Rate us' } })
    expect(onChange).toHaveBeenCalledWith({ ratingQuestion: 'Rate us' })
  })

  it('sets style → ratingStyle', () => {
    const onChange = setup()
    fireEvent.click(screen.getByRole('button', { name: /numeric/i }))
    expect(onChange).toHaveBeenCalledWith({ ratingStyle: 'numeric' })
  })

  it('sets max → ratingMax as a number', () => {
    const onChange = setup()
    fireEvent.click(screen.getByRole('button', { name: /^10$/ }))
    expect(onChange).toHaveBeenCalledWith({ ratingMax: 10 })
  })

  it('toggles required → ratingRequired', () => {
    const onChange = setup()
    fireEvent.click(screen.getByLabelText(/required/i))
    expect(onChange).toHaveBeenCalledWith({ ratingRequired: true })
  })

  it('marks the active style and max from the element', () => {
    setup({ ratingStyle: 'numeric', ratingMax: 10 })
    expect(screen.getByRole('button', { name: /numeric/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^10$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /stars/i })).toHaveAttribute('aria-pressed', 'false')
  })
})
