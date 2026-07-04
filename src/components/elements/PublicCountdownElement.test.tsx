import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicCountdownElement, remainingParts } from './PublicCountdownElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement>): CanvasElement => ({ id: '1', type: 'countdown', ...over })

describe('remainingParts', () => {
  it('splits a positive diff into d/h/m/s', () => {
    const p = remainingParts(90_061_000, 0) // 1d 1h 1m 1s
    expect(p).toMatchObject({ expired: false, days: 1, hours: 1, minutes: 1, seconds: 1 })
  })
  it('marks expired at/after target', () => {
    expect(remainingParts(0, 5).expired).toBe(true)
  })
})

describe('PublicCountdownElement', () => {
  it('shows the expired text when the target is in the past', () => {
    render(<PublicCountdownElement element={el({ countdownTarget: '2000-01-01T00:00', countdownExpiredText: 'Done!' })} />)
    expect(screen.getByText('Done!')).toBeInTheDocument()
  })
  it('renders a placeholder when no target is set', () => {
    render(<PublicCountdownElement element={el({ countdownTarget: '' })} />)
    expect(screen.getByText(/set a date/i)).toBeInTheDocument()
  })
})
