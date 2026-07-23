import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ElementStamp } from './ElementStamp'

const INSTANT = '2026-07-23T23:30:00.000Z' // 7:30 PM in New York, 12:30 AM next day in London

describe('ElementStamp', () => {
  it('renders a machine-readable <time> carrying the exact instant', () => {
    render(<ElementStamp stampedAt={INSTANT} stampedTz="UTC" />)
    expect(screen.getByRole('time')).toHaveAttribute('datetime', INSTANT)
  })

  it('renders the same instant differently for different zones', () => {
    const { unmount } = render(<ElementStamp stampedAt={INSTANT} stampedTz="America/New_York" />)
    const ny = screen.getByRole('time').textContent!
    unmount()
    render(<ElementStamp stampedAt={INSTANT} stampedTz="Europe/London" />)
    const london = screen.getByRole('time').textContent!
    expect(ny).not.toBe(london)
    expect(ny).toMatch(/July 23, 2026/)
    expect(london).toMatch(/July 24, 2026/)
  })

  it('falls back to UTC when the zone is unknown instead of throwing', () => {
    render(<ElementStamp stampedAt={INSTANT} stampedTz="Mars/Olympus_Mons" />)
    expect(screen.getByRole('time').textContent).toMatch(/July 23, 2026/)
  })

  it('falls back to UTC when no zone is given', () => {
    render(<ElementStamp stampedAt={INSTANT} />)
    expect(screen.getByRole('time').textContent).toMatch(/July 23, 2026/)
  })

  it('renders nothing for an unparseable instant', () => {
    const { container } = render(<ElementStamp stampedAt="not-a-date" stampedTz="UTC" />)
    expect(container).toBeEmptyDOMElement()
  })
})
