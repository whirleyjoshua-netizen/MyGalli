import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ShortAnswerInspector } from './ShortAnswerInspector'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1', type: 'shortanswer',
  shortAnswerQuestion: 'Your question here',
  shortAnswerPlaceholder: 'Type your answer...',
  shortAnswerRequired: false,
  shortAnswerMaxLength: 500,
  ...over,
} as CanvasElement)

const setup = (over: Partial<CanvasElement> = {}) => {
  const onChange = vi.fn()
  render(<ShortAnswerInspector element={el(over)} onChange={onChange} isPro={false} />)
  return onChange
}

describe('ShortAnswerInspector', () => {
  it('edits question → shortAnswerQuestion', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/question/i), { target: { value: 'Why?' } })
    expect(onChange).toHaveBeenCalledWith({ shortAnswerQuestion: 'Why?' })
  })

  it('edits placeholder → shortAnswerPlaceholder', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/placeholder/i), { target: { value: 'Tell us…' } })
    expect(onChange).toHaveBeenCalledWith({ shortAnswerPlaceholder: 'Tell us…' })
  })

  it('edits max length → shortAnswerMaxLength as a number', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/max length/i), { target: { value: '1500' } })
    expect(onChange).toHaveBeenCalledWith({ shortAnswerMaxLength: 1500 })
  })

  it('toggles required → shortAnswerRequired', () => {
    const onChange = setup()
    fireEvent.click(screen.getByLabelText(/required/i))
    expect(onChange).toHaveBeenCalledWith({ shortAnswerRequired: true })
  })

  it('reflects the element state', () => {
    setup({ shortAnswerRequired: true, shortAnswerMaxLength: 800 })
    expect(screen.getByLabelText(/required/i)).toBeChecked()
    expect(screen.getByLabelText(/max length/i)).toHaveValue('800')
  })
})
