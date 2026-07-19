import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCardRow } from './StatCardRow'
import { HealthGauge } from './HealthGauge'

const metrics = { views: 1284, uniqueVisitors: 812, followers: 356, shares: 74, interactions: 1102 }
const previous = { views: 1086, uniqueVisitors: 707, followers: 326, shares: 66, interactions: 910 }

describe('StatCardRow', () => {
  it('renders all five metrics with formatted values', () => {
    render(<StatCardRow metrics={metrics} previous={previous} series={{}} />)
    for (const label of ['Views', 'Visitors', 'Followers', 'Shares', 'Interactions']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(screen.getByText('1,284')).toBeTruthy()
  })

  it('shows a positive delta badge', () => {
    render(<StatCardRow metrics={metrics} previous={previous} series={{}} />)
    expect(screen.getByText('18.2%')).toBeTruthy()
  })

  it('shows "New" instead of a percentage when the baseline was zero', () => {
    render(
      <StatCardRow
        metrics={{ ...metrics, shares: 5 }}
        previous={{ ...previous, shares: 0 }}
        series={{}}
      />
    )
    expect(screen.getByText('New')).toBeTruthy()
  })
})

describe('HealthGauge', () => {
  it('renders the score and band', () => {
    render(
      <HealthGauge
        health={{ score: 92, band: 'excellent', insufficientData: false, drivers: [{ key: 'followers', label: 'Followers', delta: 18 }] }}
      />
    )
    expect(screen.getByText('92')).toBeTruthy()
    expect(screen.getByText('Excellent')).toBeTruthy()
    expect(screen.getByText('Followers')).toBeTruthy()
  })

  it('renders the prompt instead of a score when data is insufficient', () => {
    render(<HealthGauge health={{ score: 0, band: 'needs-attention', insufficientData: true, drivers: [] }} />)
    expect(screen.getByText(/Not enough data yet/i)).toBeTruthy()
    expect(screen.queryByText('0')).toBeNull()
  })
})
