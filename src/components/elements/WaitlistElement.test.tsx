import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WaitlistElement } from './WaitlistElement'

const el = { id: 'w1', type: 'waitlist', waitlistTitle: 'Join the Wait List', waitlistStyle: 'hero', waitlistButtonLabel: 'Join Wait List' } as any

describe('WaitlistElement (editor)', () => {
  it('edits the title through onChange', () => {
    const onChange = vi.fn()
    render(<WaitlistElement element={el} onChange={onChange} onDelete={vi.fn()} isSelected onSelect={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Beta Access' } })
    expect(onChange).toHaveBeenCalledWith({ waitlistTitle: 'Beta Access' })
  })

  it('switches style through onChange', () => {
    const onChange = vi.fn()
    render(<WaitlistElement element={el} onChange={onChange} onDelete={vi.fn()} isSelected onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /progress/i }))
    expect(onChange).toHaveBeenCalledWith({ waitlistStyle: 'progress' })
  })
})
