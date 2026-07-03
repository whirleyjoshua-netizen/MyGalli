import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SpacingSettingsBody } from '@/components/canvas/SpacingSettings'
import { BackgroundSettingsBody } from '@/components/canvas/BackgroundSettings'
import { ColumnStyleSettingsBody } from '@/components/canvas/ColumnStyleSettings'
import { HeaderCardEditorBody } from '@/components/header/HeaderCardEditor'
import { TabEditorBody } from '@/components/tabs/TabEditor'
import { DEFAULT_SPACING_CONFIG } from '@/lib/types/spacing'
import { DEFAULT_BACKGROUND_CONFIG } from '@/lib/types/background'
import { DEFAULT_COLUMN_SETTINGS } from '@/lib/types/canvas'
import { DEFAULT_HEADER_CARD } from '@/lib/types/header-card'
import { DEFAULT_TABS_CONFIG } from '@/lib/types/tabs'

describe('settings bodies render standalone (no modal chrome)', () => {
  it('SpacingSettingsBody renders without isOpen', () => {
    const { container } = render(<SpacingSettingsBody config={DEFAULT_SPACING_CONFIG} onChange={() => {}} />)
    expect(container.firstChild).toBeTruthy()
  })
  it('BackgroundSettingsBody renders', () => {
    const { container } = render(<BackgroundSettingsBody config={DEFAULT_BACKGROUND_CONFIG} onChange={() => {}} />)
    expect(container.firstChild).toBeTruthy()
  })
  it('ColumnStyleSettingsBody renders', () => {
    const { container } = render(<ColumnStyleSettingsBody settings={DEFAULT_COLUMN_SETTINGS} onChange={() => {}} />)
    expect(container.firstChild).toBeTruthy()
  })
  it('HeaderCardEditorBody renders', () => {
    const { container } = render(<HeaderCardEditorBody config={DEFAULT_HEADER_CARD} onChange={() => {}} />)
    expect(container.firstChild).toBeTruthy()
  })
  it('TabEditorBody renders', () => {
    const { container } = render(<TabEditorBody config={DEFAULT_TABS_CONFIG} onChange={() => {}} currentSections={[]} />)
    expect(container.firstChild).toBeTruthy()
  })
})

describe('settings bodies include a working Reset to Default control', () => {
  it('SpacingSettingsBody: clicking reset calls onChange with DEFAULT_SPACING_CONFIG', () => {
    const onChange = vi.fn()
    render(<SpacingSettingsBody config={DEFAULT_SPACING_CONFIG} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect(onChange).toHaveBeenCalledWith(DEFAULT_SPACING_CONFIG)
  })

  it('ColumnStyleSettingsBody: clicking reset calls onChange with DEFAULT_COLUMN_SETTINGS', () => {
    const onChange = vi.fn()
    render(<ColumnStyleSettingsBody settings={DEFAULT_COLUMN_SETTINGS} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect(onChange).toHaveBeenCalledWith(DEFAULT_COLUMN_SETTINGS)
  })
})
