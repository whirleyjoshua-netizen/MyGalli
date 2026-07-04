import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SectionSettingsModal } from './SectionSettingsModal'
import { DEFAULT_COLUMN_SETTINGS } from '@/lib/types/canvas'

const base = {
  isOpen: true,
  onClose: vi.fn(),
  layout: 'full-width' as const,
  onChangeLayout: vi.fn(),
  columnSettings: DEFAULT_COLUMN_SETTINGS,
  onChangeColumnSettings: vi.fn(),
}

describe('SectionSettingsModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<SectionSettingsModal {...base} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })
  it('shows the three layout options and the current one is pressed', () => {
    render(<SectionSettingsModal {...base} layout="two-column" />)
    expect(screen.getByRole('button', { name: /full width/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /two columns/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /three columns/i })).toHaveAttribute('aria-pressed', 'false')
  })
  it('calls onChangeLayout with the chosen mode', () => {
    const onChangeLayout = vi.fn()
    render(<SectionSettingsModal {...base} onChangeLayout={onChangeLayout} />)
    fireEvent.click(screen.getByRole('button', { name: /three columns/i }))
    expect(onChangeLayout).toHaveBeenCalledWith('three-column')
  })
  it('Done button calls onClose', () => {
    const onClose = vi.fn()
    render(<SectionSettingsModal {...base} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /done/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
