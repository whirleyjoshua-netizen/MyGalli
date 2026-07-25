import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SectionRow } from './SectionRow'

const group = {
  sectionId: 's1', layout: 'full-width' as const, index: 1,
  rows: [{ sectionId: 's1', columnId: 'c1', element: { id: 'e1', type: 'heading' as const, content: 'Hi' } }],
}
const base = {
  group,
  expandedElementId: null,
  displayId: 'd1',
  onToggleElement: vi.fn(),
  onChangeElement: vi.fn(),
  onDeleteElement: vi.fn(),
  onOpenSectionSettings: vi.fn(),
  onAddElement: vi.fn(),
  isPro: false,
}

describe('SectionRow', () => {
  it('renders the section header label and its element rows', () => {
    render(<SectionRow {...base} />)
    expect(screen.getByText(/Section 1/)).toBeInTheDocument()
    expect(screen.getByText(/full.width/i)).toBeInTheDocument()
    expect(screen.getByText('Heading — Hi')).toBeInTheDocument()
  })
  it('fires onOpenSectionSettings from the gear button', () => {
    const onOpenSectionSettings = vi.fn()
    render(<SectionRow {...base} onOpenSectionSettings={onOpenSectionSettings} />)
    fireEvent.click(screen.getByRole('button', { name: /section 1 settings/i }))
    expect(onOpenSectionSettings).toHaveBeenCalledWith('s1')
  })
  it('fires onAddElement from the add button', () => {
    const onAddElement = vi.fn()
    render(<SectionRow {...base} onAddElement={onAddElement} />)
    fireEvent.click(screen.getByRole('button', { name: /add element/i }))
    expect(onAddElement).toHaveBeenCalledWith('s1')
  })
})
