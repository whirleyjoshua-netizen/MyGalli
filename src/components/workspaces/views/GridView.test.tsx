import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { GridView } from './GridView'

function gridStub(over: any = {}) {
  return {
    fields: [{ id: 'f1', key: 'fee', label: 'Fee', type: 'currency', position: 0 }],
    records: [], addRow: vi.fn(), updateCell: vi.fn(), deleteRow: vi.fn(),
    addField: vi.fn(), deleteField: vi.fn(), setSort: vi.fn(),
    activeSort: null, ...over,
  } as any
}

describe('GridView', () => {
  it('clicking a column header calls setSort with the field key', () => {
    const grid = gridStub()
    render(<GridView grid={grid} />)
    fireEvent.click(screen.getByRole('button', { name: /sort by Fee/i }))
    expect(grid.setSort).toHaveBeenCalledWith('fee')
  })

  it('shows a chevron indicator on the active sort column', () => {
    const grid = gridStub({ activeSort: { field: 'fee', dir: 'asc' } })
    const { container } = render(<GridView grid={grid} />)
    expect(container.querySelector('svg.lucide-chevron-up')).toBeTruthy()
  })
})
