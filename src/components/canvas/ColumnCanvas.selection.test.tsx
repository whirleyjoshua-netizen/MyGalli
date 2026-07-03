// src/components/canvas/ColumnCanvas.selection.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ColumnCanvas } from './ColumnCanvas'
import type { Section } from '@/lib/types/canvas'

const sections: Section[] = [
  { id: 's1', layout: 'full-width', columns: [{ id: 'c1', elements: [
    { id: 'e1', type: 'heading', content: 'Hello', level: 2 },
  ] }] },
]

const baseProps = {
  sections,
  onSectionsChange: () => {},
  onAddSection: () => {},
  onDeleteSection: () => {},
  onOpenSlashMenu: () => {},
  onUpdateElement: () => {},
  onDeleteElement: () => {},
}

describe('ColumnCanvas selection is controlled', () => {
  it('calls onSelectElement with the element coordinates when a block is clicked', () => {
    const onSelectElement = vi.fn()
    render(<ColumnCanvas {...baseProps} selectedElementId={null} onSelectElement={onSelectElement} />)
    fireEvent.click(screen.getByText('Hello'))
    expect(onSelectElement).toHaveBeenCalledWith({ sectionId: 's1', columnId: 'c1', elementId: 'e1' })
  })
})
