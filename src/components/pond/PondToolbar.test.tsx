import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PondToolbar } from './PondToolbar'

it('emits query changes and sort changes', () => {
  const onQuery = vi.fn(); const onSort = vi.fn(); const onFilter = vi.fn()
  render(<PondToolbar query="" onQuery={onQuery} filter="all" onFilter={onFilter} sort="active" onSort={onSort} showFilter />)
  fireEvent.change(screen.getByPlaceholderText(/search communities/i), { target: { value: 'game' } })
  expect(onQuery).toHaveBeenCalledWith('game')
  fireEvent.change(screen.getByLabelText('Sort communities'), { target: { value: 'alpha' } })
  expect(onSort).toHaveBeenCalledWith('alpha')
})

it('hides the owned/joined filter when showFilter is false', () => {
  render(<PondToolbar query="" onQuery={() => {}} filter="all" onFilter={() => {}} sort="active" onSort={() => {}} showFilter={false} />)
  expect(screen.queryByLabelText('Filter communities')).toBeNull()
})
