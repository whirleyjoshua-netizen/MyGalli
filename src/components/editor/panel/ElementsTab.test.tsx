import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ElementsTab } from './ElementsTab'
import type { Section } from '@/lib/types/canvas'

const sections: Section[] = [
  { id: 's1', layout: 'full-width', columns: [{ id: 'c1', elements: [{ id: 'e1', type: 'heading', content: 'Hi' }] }] },
  { id: 's2', layout: 'two-column', columns: [
    { id: 'c2', elements: [{ id: 'e2', type: 'kpi', kpiLabel: 'Rev' }] },
    { id: 'c3', elements: [] },
  ] },
]
const noop = () => {}
const base = {
  sections, expandedElementId: null, displayId: 'd1',
  onToggleElement: noop, onChangeElement: noop, onDeleteElement: noop,
  onOpenSectionSettings: noop, onAddElement: noop, isPro: false,
}

describe('ElementsTab', () => {
  it('renders a group per section with their rows', () => {
    render(<ElementsTab {...base} />)
    expect(screen.getByText(/Section 1/)).toBeInTheDocument()
    expect(screen.getByText(/Section 2/)).toBeInTheDocument()
    expect(screen.getByText('Heading — Hi')).toBeInTheDocument()
    expect(screen.getByText('KPI — Rev')).toBeInTheDocument()
  })
  it('shows an empty state when there are no sections', () => {
    render(<ElementsTab {...base} sections={[]} />)
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument()
  })
})
