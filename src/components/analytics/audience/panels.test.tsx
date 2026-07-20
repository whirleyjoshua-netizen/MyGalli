import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GeographyList } from './GeographyList'
import { SourcesBreakdown } from './SourcesBreakdown'

describe('GeographyList', () => {
  const geography = [
    { country: 'US', count: 62 },
    { country: 'CA', count: 18 },
  ]

  it('names countries and shows their share of located visits', () => {
    render(<GeographyList geography={geography} unknownCountryEvents={0} />)
    expect(screen.getByText('United States')).toBeTruthy()
    expect(screen.getByText('78%')).toBeTruthy()
  })

  it('discloses how many events had no country', () => {
    render(<GeographyList geography={geography} unknownCountryEvents={5} />)
    expect(screen.getByText(/5 visits/i)).toBeTruthy()
  })

  it('says nothing about unknowns when there are none', () => {
    render(<GeographyList geography={geography} unknownCountryEvents={0} />)
    expect(screen.queryByText(/couldn't be located/i)).toBeNull()
  })

  it('shows an empty state with no located visits', () => {
    render(<GeographyList geography={[]} unknownCountryEvents={0} />)
    expect(screen.getByText(/No location data yet/i)).toBeTruthy()
  })

  it('never renders NaN when counts are all zero', () => {
    const { container } = render(
      <GeographyList geography={[{ country: 'US', count: 0 }]} unknownCountryEvents={0} />
    )
    expect(container.textContent).not.toMatch(/NaN/)
  })

  it('discloses how many countries are hidden past the cap of 10', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ country: `C${i}`, count: 12 - i }))
    render(<GeographyList geography={many} unknownCountryEvents={0} />)
    expect(screen.getByText(/2 more countries are not shown/i)).toBeTruthy()
  })

  it('says nothing about hidden rows when everything fits', () => {
    render(<GeographyList geography={geography} unknownCountryEvents={0} />)
    expect(screen.queryByText(/not shown/i)).toBeNull()
  })
})

describe('SourcesBreakdown', () => {
  it('labels each source category with its share', () => {
    render(
      <SourcesBreakdown
        sources={[
          { source: 'search', count: 30 },
          { source: 'direct', count: 10 },
        ]}
      />
    )
    expect(screen.getByText('Search')).toBeTruthy()
    expect(screen.getByText('75%')).toBeTruthy()
  })

  it('shows an empty state with no sources', () => {
    render(<SourcesBreakdown sources={[]} />)
    expect(screen.getByText(/No traffic sources yet/i)).toBeTruthy()
  })
})
