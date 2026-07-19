import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionEngagementBars } from './SectionEngagementBars'
import { WidgetPerformanceTable } from './WidgetPerformanceTable'
import { ReferrerDonut } from './ReferrerDonut'
import { QuickActions } from './QuickActions'

describe('SectionEngagementBars', () => {
  it('renders each section with its percentage of the busiest section', () => {
    render(<SectionEngagementBars rows={[
      { id: 's1', label: 'Landing Hero', count: 68 },
      { id: 's2', label: 'Gallery', count: 34 },
    ]} />)
    expect(screen.getByText('Landing Hero')).toBeTruthy()
    expect(screen.getByText('68')).toBeTruthy()
  })

  it('shows an empty state when nothing has been interacted with', () => {
    render(<SectionEngagementBars rows={[]} />)
    expect(screen.getByText(/No section activity yet/i)).toBeTruthy()
  })
})

describe('WidgetPerformanceTable', () => {
  it('renders a row per widget with its primary stat', () => {
    render(<WidgetPerformanceTable rows={[
      { elementType: 'poll', label: 'Poll', stat: '53% of viewers voted', count: 53, trend: [1, 3, 2] },
    ]} />)
    expect(screen.getByText('Poll')).toBeTruthy()
    expect(screen.getByText('53% of viewers voted')).toBeTruthy()
  })

  it('shows an empty state with no widgets', () => {
    render(<WidgetPerformanceTable rows={[]} />)
    expect(screen.getByText(/No widget activity yet/i)).toBeTruthy()
  })
})

describe('ReferrerDonut', () => {
  it('renders each referrer with a share percentage', () => {
    render(<ReferrerDonut referrers={[{ domain: 'instagram.com', count: 32 }, { domain: 'google.com', count: 18 }]} totalViews={100} />)
    expect(screen.getByText('instagram.com')).toBeTruthy()
    expect(screen.getByText('32%')).toBeTruthy()
  })

  it('shows an empty state with no referrers', () => {
    render(<ReferrerDonut referrers={[]} totalViews={0} />)
    expect(screen.getByText(/No referrers yet/i)).toBeTruthy()
  })
})

describe('QuickActions', () => {
  it('links to the editor, public page and settings', () => {
    render(<QuickActions username="josh" slug="my-page" displayId="d1" />)
    expect(screen.getByText('Create New Page')).toBeTruthy()
    expect(screen.getByText('View as Visitor').closest('a')?.getAttribute('href')).toBe('/josh/my-page')
  })

  it('omits the visitor link when the page has no public URL yet', () => {
    render(<QuickActions username={null} slug={null} displayId="d1" />)
    expect(screen.queryByText('View as Visitor')).toBeNull()
  })
})
