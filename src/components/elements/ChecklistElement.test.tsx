import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChecklistElement } from './ChecklistElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1', type: 'checklist',
  checklistTitle: 'Launch',
  checklistItems: [
    { id: 'a', text: 'Domain', done: false },
    { id: 'b', text: 'Copy', done: false },
  ],
  checklistShowProgress: true,
  ...over,
} as CanvasElement)

const props = (over: Partial<CanvasElement> = {}) => ({
  element: el(over), onChange: vi.fn(), onDelete: vi.fn(), isSelected: true, onSelect: vi.fn(),
})

describe('ChecklistElement', () => {
  it('toggles an item done when its checkbox is clicked', () => {
    const p = props()
    render(<ChecklistElement {...p} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /domain/i }))
    expect(p.onChange).toHaveBeenCalledWith({
      checklistItems: [
        { id: 'a', text: 'Domain', done: true },
        { id: 'b', text: 'Copy', done: false },
      ],
    })
  })

  it('adds an item', () => {
    const p = props()
    render(<ChecklistElement {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /add item/i }))
    const arg = p.onChange.mock.calls[0][0].checklistItems
    expect(arg).toHaveLength(3)
    expect(arg[2]).toMatchObject({ done: false })
    expect(arg[2].id).toBeTruthy()
  })

  it('removes an item', () => {
    const p = props()
    render(<ChecklistElement {...p} />)
    fireEvent.click(screen.getAllByRole('button', { name: /remove item/i })[0])
    expect(p.onChange).toHaveBeenCalledWith({
      checklistItems: [{ id: 'b', text: 'Copy', done: false }],
    })
  })

  it('flips the show-progress toggle', () => {
    const p = props()
    render(<ChecklistElement {...p} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /show progress/i }))
    expect(p.onChange).toHaveBeenCalledWith({ checklistShowProgress: false })
  })
})
