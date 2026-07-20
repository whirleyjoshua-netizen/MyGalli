import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AudienceHeadline } from './AudienceHeadline'
import { PeakHoursChart } from './PeakHoursChart'

const summary = {
  visitors: 412, sessions: 587, newVisitors: 255, returningVisitors: 157,
  avgSessionSeconds: 154, bounceRate: 43.2, measuredSessions: 300,
}

describe('AudienceHeadline', () => {
  it('shows visitors and sessions as distinct numbers', () => {
    render(<AudienceHeadline summary={summary} identityFallback={false} />)
    expect(screen.getByText('412')).toBeTruthy()
    expect(screen.getByText('587')).toBeTruthy()
  })

  it('formats the average session as minutes and seconds with its sample size', () => {
    render(<AudienceHeadline summary={summary} identityFallback={false} />)
    expect(screen.getByText('2m 34s')).toBeTruthy()
    expect(screen.getByText(/over 300 sessions/i)).toBeTruthy()
  })

  it('shows a dash rather than 0s when no session was measurable', () => {
    render(
      <AudienceHeadline
        summary={{ ...summary, avgSessionSeconds: null, measuredSessions: 0 }}
        identityFallback={false}
      />
    )
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.queryByText('0s')).toBeNull()
  })

  it('shows the returning share', () => {
    render(<AudienceHeadline summary={summary} identityFallback={false} />)
    expect(screen.getByText('38.1%')).toBeTruthy()
  })

  it('discloses the identity fallback only when it applies', () => {
    const { rerender } = render(<AudienceHeadline summary={summary} identityFallback={false} />)
    expect(screen.queryByText(/overcount/i)).toBeNull()

    rerender(<AudienceHeadline summary={summary} identityFallback />)
    expect(screen.getByText(/overcount/i)).toBeTruthy()
  })
})

describe('PeakHoursChart', () => {
  it('renders 24 bars and labels the busiest hour', () => {
    const counts = Array.from({ length: 24 }, (_, h) => (h === 18 ? 40 : 1))
    const { container } = render(<PeakHoursChart hourCountsUtc={counts} />)
    expect(container.querySelectorAll('[data-hour]')).toHaveLength(24)
    expect(screen.getByText(/peak/i)).toBeTruthy()
  })

  it('shows an empty state when there is no traffic', () => {
    render(<PeakHoursChart hourCountsUtc={new Array(24).fill(0)} />)
    expect(screen.getByText(/No traffic yet/i)).toBeTruthy()
  })

  it('states which timezone the chart is drawn in', () => {
    const counts = Array.from({ length: 24 }, () => 1)
    render(<PeakHoursChart hourCountsUtc={counts} />)
    expect(screen.getByText(/your time/i)).toBeTruthy()
  })
})
