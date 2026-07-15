import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GridCell } from './GridCell'

const field = (type: string) => ({ id: 'f', key: 'k', label: 'L', type, position: 0 })

describe('GridCell', () => {
  it('commits text on blur', () => {
    const onCommit = vi.fn()
    render(<GridCell field={field('text') as any} value="" onCommit={onCommit} />)
    const cell = screen.getByTestId('cell-display')
    fireEvent.click(cell)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledWith('hello')
  })

  it('checkbox commits immediately on toggle', () => {
    const onCommit = vi.fn()
    render(<GridCell field={field('checkbox') as any} value={false} onCommit={onCommit} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onCommit).toHaveBeenCalledWith(true)
  })

  it('normalizes an ISO date value to yyyy-MM-dd when entering edit mode', () => {
    const onCommit = vi.fn()
    render(<GridCell field={field('date') as any} value="2026-07-14T00:00:00.000Z" onCommit={onCommit} />)
    fireEvent.click(screen.getByTestId('cell-display'))
    const input = screen.getByDisplayValue('2026-07-14') as HTMLInputElement
    expect(input.value).toBe('2026-07-14')
  })

  it('renders a url as a safe new-tab link', () => {
    const onCommit = vi.fn()
    render(<GridCell field={field('url') as any} value="https://example.com" onCommit={onCommit} />)
    const a = screen.getByRole('link') as HTMLAnchorElement
    expect(a.href).toContain('example.com')
    expect(a.target).toBe('_blank')
  })
  it('rating commits the clicked star value', () => {
    const onCommit = vi.fn()
    render(<GridCell field={{ id: 'f', key: 'k', label: 'L', type: 'rating', position: 0, config: { max: 5 } } as any} value={0} onCommit={onCommit} />)
    const stars = screen.getAllByRole('button')
    fireEvent.click(stars[2]) // 3rd star
    expect(onCommit).toHaveBeenCalledWith(3)
  })
  it('formats currency in display', () => {
    render(<GridCell field={{ id: 'f', key: 'k', label: 'L', type: 'currency', position: 0, config: { symbol: '$' } } as any} value={1200} onCommit={vi.fn()} />)
    expect(screen.getByText('$1,200')).toBeInTheDocument()
  })
})
