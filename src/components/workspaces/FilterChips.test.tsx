import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterChips } from './FilterChips'

const fields = [
  { id: 'f1', key: 'sport', label: 'Sport', type: 'choice', position: 0, config: { options: ['Soccer'] } },
  { id: 'f2', key: 'fee', label: 'Fee', type: 'currency', position: 1, config: { symbol: '$' } },
] as any

const filter = {
  op: 'and',
  conditions: [
    { field: 'sport', cmp: 'eq', value: 'Soccer' },
    { field: 'fee', cmp: 'gt', value: 1200 },
  ],
} as any

describe('FilterChips', () => {
  it('shows the filter in plain language with labels, not keys', () => {
    render(<FilterChips filter={filter} fields={fields} />)
    expect(screen.getByText(/Sport is Soccer/)).toBeInTheDocument()
    expect(screen.queryByText(/"sport"/)).not.toBeInTheDocument()
  })

  it('renders nothing when there is no filter', () => {
    const { container } = render(<FilterChips filter={null} fields={fields} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('calls onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn()
    render(<FilterChips filter={filter} fields={fields} onRemove={onRemove} />)
    fireEvent.click(screen.getByTitle('Remove filter'))
    expect(onRemove).toHaveBeenCalled()
  })
})
