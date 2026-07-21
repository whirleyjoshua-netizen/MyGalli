import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterRail } from './FilterRail'
import type { ElementFilter } from '@/lib/element-os'

const filter: ElementFilter = { search: '', types: [], statuses: [], source: 'all' }
const counts = { 'needs-attention': 12, live: 4, draft: 2, idle: 1 }

const setup = (over: Partial<React.ComponentProps<typeof FilterRail>> = {}) => {
  const onChange = vi.fn()
  const onSortChange = vi.fn()
  const onReset = vi.fn()
  render(
    <FilterRail
      filter={filter}
      sort="most-active"
      statusCounts={counts}
      onChange={onChange}
      onSortChange={onSortChange}
      onReset={onReset}
      {...over}
    />
  )
  return { onChange, onSortChange, onReset }
}

describe('FilterRail', () => {
  it('emits search text', () => {
    const { onChange } = setup()
    fireEvent.change(screen.getByPlaceholderText(/search elements/i), { target: { value: 'nba' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ search: 'nba' }))
  })

  it('toggles a type chip on', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Polls' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ types: ['poll', 'mcq'] }))
  })

  it('toggles a selected type chip back off', () => {
    const { onChange } = setup({ filter: { ...filter, types: ['poll', 'mcq'] } })
    fireEvent.click(screen.getByRole('button', { name: 'Polls' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ types: [] }))
  })

  it('shows a count beside each status', () => {
    setup()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('Need Attention')).toBeTruthy()
  })

  it('toggles a status checkbox', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByLabelText(/live now/i))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ statuses: ['live'] }))
  })

  it('switches source', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Bulletin' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ source: 'bulletin' }))
  })

  it('emits a sort change', () => {
    const { onSortChange } = setup()
    fireEvent.change(screen.getByLabelText(/sort by/i), { target: { value: 'stale' } })
    expect(onSortChange).toHaveBeenCalledWith('stale')
  })

  it('resets', () => {
    const { onReset } = setup()
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect(onReset).toHaveBeenCalled()
  })
})
