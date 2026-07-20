import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AudienceBreakdowns } from './AudienceBreakdowns'

describe('AudienceBreakdowns', () => {
  it('renders devices and browsers ranked descending with correct percentages', () => {
    render(
      <AudienceBreakdowns
        devices={{ desktop: 30, mobile: 60, tablet: 10 }}
        browsers={{ chrome: 50, safari: 30, firefox: 20 }}
      />
    )

    expect(screen.getByText('Devices')).toBeTruthy()
    expect(screen.getByText('Browsers')).toBeTruthy()

    // capitalised labels
    expect(screen.getByText('Mobile')).toBeTruthy()
    expect(screen.getByText('Desktop')).toBeTruthy()
    expect(screen.getByText('Tablet')).toBeTruthy()
    expect(screen.getByText('Chrome')).toBeTruthy()
    expect(screen.getByText('Safari')).toBeTruthy()
    expect(screen.getByText('Firefox')).toBeTruthy()

    // percentages
    expect(screen.getByText('60%')).toBeTruthy()
    expect(screen.getAllByText('30%').length).toBe(2) // desktop 30% and safari 30%
    expect(screen.getByText('10%')).toBeTruthy()
    expect(screen.getByText('50%')).toBeTruthy()
    expect(screen.getByText('20%')).toBeTruthy()
  })

  it('ranks entries descending by count', () => {
    render(
      <AudienceBreakdowns
        devices={{ tablet: 5, desktop: 50, mobile: 20 }}
        browsers={{}}
      />
    )
    const labels = screen.getAllByText(/Desktop|Mobile|Tablet/).map((el) => el.textContent)
    expect(labels).toEqual(['Desktop', 'Mobile', 'Tablet'])
  })

  it('shows illustrated empty state for an empty devices record while browsers renders normally', () => {
    render(
      <AudienceBreakdowns
        devices={{}}
        browsers={{ chrome: 10 }}
      />
    )
    expect(screen.getByText(/No device data yet/i)).toBeTruthy()
    expect(screen.getByText('Chrome')).toBeTruthy()
    expect(screen.getByText('100%')).toBeTruthy()
    expect(screen.queryByText(/No browser data yet/i)).toBeNull()
  })

  it('shows illustrated empty state for an empty browsers record while devices renders normally', () => {
    render(
      <AudienceBreakdowns
        devices={{ desktop: 5 }}
        browsers={{}}
      />
    )
    expect(screen.getByText(/No browser data yet/i)).toBeTruthy()
    expect(screen.getByText('Desktop')).toBeTruthy()
    expect(screen.queryByText(/No device data yet/i)).toBeNull()
  })

  it('never renders NaN% for an empty total', () => {
    render(<AudienceBreakdowns devices={{}} browsers={{}} />)
    expect(screen.queryByText(/NaN/)).toBeNull()
    expect(screen.getByText(/No device data yet/i)).toBeTruthy()
    expect(screen.getByText(/No browser data yet/i)).toBeTruthy()
  })
})
