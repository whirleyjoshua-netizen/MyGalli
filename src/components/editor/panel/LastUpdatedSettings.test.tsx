import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LastUpdatedSettingsBody } from './LastUpdatedSettings'

describe('LastUpdatedSettingsBody', () => {
  it('reflects the current value', () => {
    render(<LastUpdatedSettingsBody value onChange={vi.fn()} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('reflects being off', () => {
    render(<LastUpdatedSettingsBody value={false} onChange={vi.fn()} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles to the opposite value', () => {
    const onChange = vi.fn()
    render(<LastUpdatedSettingsBody value={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  // The owner must know the date becomes public before flipping it.
  it('states that the date is public', () => {
    render(<LastUpdatedSettingsBody value={false} onChange={vi.fn()} />)
    expect(screen.getByText(/visitors/i)).toBeInTheDocument()
  })
})
