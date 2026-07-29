import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MCQInspector } from './MCQInspector'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1', type: 'mcq',
  mcqQuestion: 'Your question here',
  mcqOptions: ['Option 1', 'Option 2', 'Option 3'],
  mcqAllowMultiple: false,
  mcqRequired: false,
  ...over,
} as CanvasElement)

const setup = (over: Partial<CanvasElement> = {}) => {
  const onChange = vi.fn()
  render(<MCQInspector element={el(over)} onChange={onChange} isPro={false} />)
  return onChange
}

describe('MCQInspector', () => {
  it('edits question → mcqQuestion', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/question/i), { target: { value: 'Pick one' } })
    expect(onChange).toHaveBeenCalledWith({ mcqQuestion: 'Pick one' })
  })

  it('toggles allow multiple → mcqAllowMultiple', () => {
    const onChange = setup()
    fireEvent.click(screen.getByLabelText(/allow multiple/i))
    expect(onChange).toHaveBeenCalledWith({ mcqAllowMultiple: true })
  })

  it('toggles required → mcqRequired', () => {
    const onChange = setup()
    fireEvent.click(screen.getByLabelText(/required/i))
    expect(onChange).toHaveBeenCalledWith({ mcqRequired: true })
  })

  it('reflects the element state', () => {
    setup({ mcqAllowMultiple: true, mcqRequired: true })
    expect(screen.getByLabelText(/allow multiple/i)).toBeChecked()
    expect(screen.getByLabelText(/required/i)).toBeChecked()
  })

  it('tells the author the options are edited on the card', () => {
    setup()
    expect(screen.getByText(/options are edited on the card/i)).toBeInTheDocument()
  })
})
