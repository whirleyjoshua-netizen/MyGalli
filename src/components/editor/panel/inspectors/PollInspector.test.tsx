import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PollInspector } from './PollInspector'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1', type: 'poll',
  pollQuestion: 'What do you think?',
  pollOptions: ['Option 1', 'Option 2', 'Option 3'],
  pollAllowMultiple: false,
  pollShowResultsBeforeVote: false,
  ...over,
} as CanvasElement)

const setup = (over: Partial<CanvasElement> = {}) => {
  const onChange = vi.fn()
  render(<PollInspector element={el(over)} onChange={onChange} isPro={false} />)
  return onChange
}

describe('PollInspector', () => {
  it('edits question → pollQuestion', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/question/i), { target: { value: 'Best colour?' } })
    expect(onChange).toHaveBeenCalledWith({ pollQuestion: 'Best colour?' })
  })

  it('toggles allow multiple → pollAllowMultiple', () => {
    const onChange = setup()
    fireEvent.click(screen.getByLabelText(/allow multiple/i))
    expect(onChange).toHaveBeenCalledWith({ pollAllowMultiple: true })
  })

  it('toggles show results before voting → pollShowResultsBeforeVote', () => {
    const onChange = setup()
    fireEvent.click(screen.getByLabelText(/show results before voting/i))
    expect(onChange).toHaveBeenCalledWith({ pollShowResultsBeforeVote: true })
  })

  it('reflects the element state', () => {
    setup({ pollAllowMultiple: true, pollShowResultsBeforeVote: true })
    expect(screen.getByLabelText(/allow multiple/i)).toBeChecked()
    expect(screen.getByLabelText(/show results before voting/i)).toBeChecked()
  })

  it('tells the author the options are edited on the card', () => {
    setup()
    expect(screen.getByText(/options are edited on the card/i)).toBeInTheDocument()
  })
})
