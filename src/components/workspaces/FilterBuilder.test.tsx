import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBuilder } from './FilterBuilder'
import type { GridField } from './useWorkspaceGrid'
import type { FilterSpec } from '@/lib/workspaces/filter'

const fields: GridField[] = [
  { id: 'f1', key: 'name', label: 'Name', type: 'text', position: 0 },
  { id: 'f2', key: 'status', label: 'Status', type: 'choice', position: 1, config: { options: ['Todo', 'Done'] } },
  { id: 'f3', key: 'fee', label: 'Fee', type: 'currency', position: 2 },
  { id: 'f4', key: 'due', label: 'Due', type: 'date', position: 3 },
]

let onApply: (next: FilterSpec | null) => void
let onClose: () => void
beforeEach(() => {
  onApply = vi.fn()
  onClose = vi.fn()
})

const open = (value = null as any) =>
  render(<FilterBuilder fields={fields} value={value} onApply={onApply} onClose={onClose} />)

describe('FilterBuilder', () => {
  it('starts empty with a single add-condition affordance', () => {
    open()
    expect(screen.getByRole('button', { name: /add condition/i })).toBeTruthy()
    expect(screen.queryByLabelText('Field 1')).toBeNull()
  })

  it('adds a row seeded with the first field and its first legal comparator', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    expect((screen.getByLabelText('Field 1') as HTMLSelectElement).value).toBe('name')
    expect((screen.getByLabelText('Comparator 1') as HTMLSelectElement).value).toBe('eq')
  })

  it('offers only the comparators legal for the chosen field type', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Field 1'), { target: { value: 'status' } })
    const opts = Array.from((screen.getByLabelText('Comparator 1') as HTMLSelectElement).options).map((o) => o.value)
    // choice: eq, neq + the two value-less ones. No ordering comparators.
    expect(opts).toEqual(['eq', 'neq', 'is_empty', 'is_not_empty'])
  })

  it('resets a comparator that is illegal for the newly chosen field', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Field 1'), { target: { value: 'fee' } })
    fireEvent.change(screen.getByLabelText('Comparator 1'), { target: { value: 'gt' } })
    // 'gt' is not legal for a choice field — it must fall back, not persist.
    fireEvent.change(screen.getByLabelText('Field 1'), { target: { value: 'status' } })
    expect((screen.getByLabelText('Comparator 1') as HTMLSelectElement).value).toBe('eq')
  })

  it('renders a dropdown of options for a choice field', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Field 1'), { target: { value: 'status' } })
    const opts = Array.from((screen.getByLabelText('Value 1') as HTMLSelectElement).options).map((o) => o.value)
    expect(opts).toEqual(['', 'Todo', 'Done'])
  })

  it('hides the value control for a value-less comparator', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Field 1'), { target: { value: 'due' } })
    fireEvent.change(screen.getByLabelText('Comparator 1'), { target: { value: 'is_empty' } })
    expect(screen.queryByLabelText('Value 1')).toBeNull()
  })

  it('applies a validated spec and closes', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Field 1'), { target: { value: 'status' } })
    fireEvent.change(screen.getByLabelText('Value 1'), { target: { value: 'Done' } })
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))
    expect(onApply).toHaveBeenCalledWith({ op: 'and', conditions: [{ field: 'status', cmp: 'eq', value: 'Done' }] })
    expect(onClose).toHaveBeenCalled()
  })

  it('omits the value key entirely for a value-less condition', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Field 1'), { target: { value: 'due' } })
    fireEvent.change(screen.getByLabelText('Comparator 1'), { target: { value: 'is_empty' } })
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))
    expect(onApply).toHaveBeenCalledWith({ op: 'and', conditions: [{ field: 'due', cmp: 'is_empty' }] })
  })

  it('shows the and/or toggle only once there are two conditions', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    expect(screen.queryByLabelText('Match')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    expect(screen.getByLabelText('Match')).toBeTruthy()
  })

  it('applies an or-filter when the toggle is switched', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Value 1'), { target: { value: 'a' } })
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Value 2'), { target: { value: 'b' } })
    fireEvent.change(screen.getByLabelText('Match'), { target: { value: 'or' } })
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))
    expect(onApply).toHaveBeenCalledWith({
      op: 'or',
      conditions: [
        { field: 'name', cmp: 'eq', value: 'a' },
        { field: 'name', cmp: 'eq', value: 'b' },
      ],
    })
  })

  it('surfaces the validator message inline instead of applying', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Field 1'), { target: { value: 'due' } })
    // A native <input type="date"> refuses to hold an ambiguous format like
    // "07/01/2026" in the first place — jsdom mirrors real browsers here and
    // leaves the value blank, which is exactly the scenario the blank-value
    // guard in coerce() now catches first.
    fireEvent.change(screen.getByLabelText('Value 1'), { target: { value: '07/01/2026' } })
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))
    expect(onApply).not.toHaveBeenCalled()
    expect(screen.getByText(/"Due" needs a value/)).toBeTruthy()
  })

  it('applies null when every row is removed', () => {
    open({ op: 'and', conditions: [{ field: 'name', cmp: 'eq', value: 'x' }] })
    fireEvent.click(screen.getByRole('button', { name: /remove condition 1/i }))
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))
    expect(onApply).toHaveBeenCalledWith(null)
  })

  it('hydrates from an existing filter so it can be edited', () => {
    open({ op: 'or', conditions: [{ field: 'status', cmp: 'neq', value: 'Done' }, { field: 'due', cmp: 'is_empty' }] })
    expect((screen.getByLabelText('Field 1') as HTMLSelectElement).value).toBe('status')
    expect((screen.getByLabelText('Comparator 1') as HTMLSelectElement).value).toBe('neq')
    expect((screen.getByLabelText('Comparator 2') as HTMLSelectElement).value).toBe('is_empty')
    expect((screen.getByLabelText('Match') as HTMLSelectElement).value).toBe('or')
  })
})
