import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchBox } from './SearchBox'

const onChange = vi.fn()
const onSubmit = vi.fn()
const onClear = vi.fn()

beforeEach(() => vi.clearAllMocks())

describe('SearchBox', () => {
  it('reports typing through onChange', () => {
    render(<SearchBox value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'surf' } })
    expect(onChange).toHaveBeenCalledWith('surf')
  })

  it('shows the current value', () => {
    render(<SearchBox value="surf" onChange={onChange} />)
    expect((screen.getByLabelText('Search') as HTMLInputElement).value).toBe('surf')
  })

  it('calls onSubmit when the form is submitted', () => {
    render(<SearchBox value="surf" onChange={onChange} onSubmit={onSubmit} />)
    fireEvent.submit(screen.getByRole('search'))
    expect(onSubmit).toHaveBeenCalled()
  })

  it('does not throw on submit when no onSubmit is given', () => {
    render(<SearchBox value="surf" onChange={onChange} />)
    expect(() => fireEvent.submit(screen.getByRole('search'))).not.toThrow()
  })

  it('shows the clear button only when onClear is given and value is non-empty', () => {
    const { rerender } = render(<SearchBox value="surf" onChange={onChange} onClear={onClear} />)
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument()

    rerender(<SearchBox value="" onChange={onChange} onClear={onClear} />)
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()

    rerender(<SearchBox value="surf" onChange={onChange} />)
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
  })

  it('calls onClear when the clear button is clicked', () => {
    render(<SearchBox value="surf" onChange={onChange} onClear={onClear} />)
    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(onClear).toHaveBeenCalled()
  })

  it('does not submit the form when the clear button is clicked', () => {
    render(<SearchBox value="surf" onChange={onChange} onSubmit={onSubmit} onClear={onClear} />)
    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('uses a default placeholder and accepts an override', () => {
    const { rerender } = render(<SearchBox value="" onChange={onChange} />)
    expect(screen.getByPlaceholderText('Search My Galli pages…')).toBeInTheDocument()

    rerender(<SearchBox value="" onChange={onChange} placeholder="Find people" />)
    expect(screen.getByPlaceholderText('Find people')).toBeInTheDocument()
  })

  // The pill inherits no colour from the bar, so a tone mismatch renders it
  // invisible (white chrome on white). jsdom has no layout; the class is the
  // only observable.
  describe('tone', () => {
    it('defaults to the glass pill', () => {
      render(<SearchBox value="" onChange={onChange} />)
      expect(screen.getByRole('search')).toHaveClass('border-white/30', 'bg-white/15')
    })

    it('darkens the pill for the light tone so it stays visible on white', () => {
      render(<SearchBox value="" onChange={onChange} tone="light" />)
      const form = screen.getByRole('search')
      expect(form).toHaveClass('border-border', 'bg-background')
      expect(form).not.toHaveClass('bg-white/15')
      expect(screen.getByLabelText('Search')).toHaveClass('text-foreground')
    })
  })
})
