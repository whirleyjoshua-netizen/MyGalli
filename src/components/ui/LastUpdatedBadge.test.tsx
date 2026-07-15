import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LastUpdatedBadge } from './LastUpdatedBadge'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'))
})
afterEach(() => vi.useRealTimers())

describe('LastUpdatedBadge', () => {
  it('renders the relative time in prose', () => {
    render(<LastUpdatedBadge date={new Date('2026-07-12T12:00:00.000Z')} />)
    expect(screen.getByText('Updated 3 days ago')).toBeInTheDocument()
  })

  it('exposes the exact date on hover and to machines', () => {
    render(<LastUpdatedBadge date={new Date('2026-07-12T12:00:00.000Z')} />)
    const el = screen.getByText('Updated 3 days ago')
    expect(el.tagName).toBe('TIME')
    expect(el).toHaveAttribute('dateTime', '2026-07-12T12:00:00.000Z')
    expect(el).toHaveAttribute('title', 'July 12, 2026')
  })
})
