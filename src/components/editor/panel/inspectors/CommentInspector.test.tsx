import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommentInspector } from './CommentInspector'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1', type: 'comment',
  commentTitle: 'Comments',
  commentRequireName: true,
  commentRequireEmail: false,
  commentModerated: false,
  commentMaxLength: 1000,
  ...over,
} as CanvasElement)

const setup = (over: Partial<CanvasElement> = {}) => {
  const onChange = vi.fn()
  render(<CommentInspector element={el(over)} onChange={onChange} isPro={false} />)
  return onChange
}

describe('CommentInspector', () => {
  it('toggles require name → commentRequireName', () => {
    const onChange = setup()
    fireEvent.click(screen.getByLabelText(/require name/i))
    expect(onChange).toHaveBeenCalledWith({ commentRequireName: false })
  })

  it('toggles require email → commentRequireEmail', () => {
    const onChange = setup()
    fireEvent.click(screen.getByLabelText(/require email/i))
    expect(onChange).toHaveBeenCalledWith({ commentRequireEmail: true })
  })

  it('toggles moderation → commentModerated', () => {
    const onChange = setup()
    fireEvent.click(screen.getByLabelText(/moderate/i))
    expect(onChange).toHaveBeenCalledWith({ commentModerated: true })
  })

  it('edits max length → commentMaxLength as a number', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/max length/i), { target: { value: '2500' } })
    expect(onChange).toHaveBeenCalledWith({ commentMaxLength: 2500 })
  })

  it('reflects the element state', () => {
    setup({ commentRequireName: false, commentModerated: true, commentMaxLength: 300 })
    expect(screen.getByLabelText(/require name/i)).not.toBeChecked()
    expect(screen.getByLabelText(/moderate/i)).toBeChecked()
    expect(screen.getByLabelText(/max length/i)).toHaveValue('300')
  })

  it('leaves the title and theme on the card', () => {
    setup()
    expect(screen.getByText(/title and theme are set on the card/i)).toBeInTheDocument()
  })
})
