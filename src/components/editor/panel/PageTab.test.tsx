import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageTab } from './PageTab'
import { DEFAULT_BACKGROUND_CONFIG } from '@/lib/types/background'
import { DEFAULT_SPACING_CONFIG } from '@/lib/types/spacing'
import { DEFAULT_HEADER_CARD } from '@/lib/types/header-card'
import { DEFAULT_TABS_CONFIG } from '@/lib/types/tabs'

const base = {
  background: DEFAULT_BACKGROUND_CONFIG, onBackgroundChange: () => {},
  spacing: DEFAULT_SPACING_CONFIG, onSpacingChange: () => {},
  headerCard: DEFAULT_HEADER_CARD, onHeaderCardChange: () => {},
  tabsConfig: DEFAULT_TABS_CONFIG, onTabsChange: () => {},
  currentSections: [],
  showLastUpdated: false, onShowLastUpdatedChange: () => {},
}

describe('PageTab', () => {
  it('shows the four settings sections', () => {
    render(<PageTab {...base} />)
    expect(screen.getByText(/^Background$/)).toBeInTheDocument()
    expect(screen.getByText(/Spacing & layout/i)).toBeInTheDocument()
    expect(screen.getByText(/^Header card\b/i)).toBeInTheDocument()
    expect(screen.getByText(/^Tabs$/)).toBeInTheDocument()
  })
})
