import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IndexInspector } from './IndexInspector'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1', type: 'index',
  indexTitle: 'Index', indexIcon: '🔎',
  indexView: 'list', indexEnableSearch: true, indexEnableNumbers: true,
  indexAccent: '#39D98A', indexEntries: [],
  ...over,
} as CanvasElement)

const setup = (over: Partial<CanvasElement> = {}) => {
  const onChange = vi.fn()
  render(<IndexInspector element={el(over)} onChange={onChange} isPro={false} />)
  return onChange
}

describe('IndexInspector', () => {
  it('sets view → indexView', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/view/i), { target: { value: 'cards' } })
    expect(onChange).toHaveBeenCalledWith({ indexView: 'cards' })
  })

  it('toggles the search box → indexEnableSearch', () => {
    const onChange = setup()
    fireEvent.click(screen.getByLabelText(/search box/i))
    expect(onChange).toHaveBeenCalledWith({ indexEnableSearch: false })
  })

  it('toggles auto-number → indexEnableNumbers', () => {
    const onChange = setup()
    fireEvent.click(screen.getByLabelText(/auto-number/i))
    expect(onChange).toHaveBeenCalledWith({ indexEnableNumbers: false })
  })

  it('edits accent → indexAccent', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/accent/i), { target: { value: '#ff0000' } })
    expect(onChange).toHaveBeenCalledWith({ indexAccent: '#ff0000' })
  })

  it('defaults search and numbers to on when unset, matching the element', () => {
    setup({ indexEnableSearch: undefined, indexEnableNumbers: undefined })
    expect(screen.getByLabelText(/search box/i)).toBeChecked()
    expect(screen.getByLabelText(/auto-number/i)).toBeChecked()
  })

  it('leaves the entries to the card', () => {
    setup()
    expect(screen.getByText(/entries are edited on the card/i)).toBeInTheDocument()
  })
})
