import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicChecklistElement } from './PublicChecklistElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1', type: 'checklist',
  checklistTitle: 'Launch',
  checklistItems: [
    { id: 'a', text: 'Domain', done: true },
    { id: 'b', text: 'Copy', done: false },
  ],
  checklistShowProgress: true,
  ...over,
} as CanvasElement)

describe('PublicChecklistElement', () => {
  it('shows the title and every item', () => {
    render(<PublicChecklistElement element={el()} />)
    expect(screen.getByText('Launch')).toBeInTheDocument()
    expect(screen.getByText('Domain')).toBeInTheDocument()
    expect(screen.getByText('Copy')).toBeInTheDocument()
  })

  it('marks done and not-done items differently', () => {
    render(<PublicChecklistElement element={el()} />)
    expect(screen.getByText('Domain').closest('[data-done]')).toHaveAttribute('data-done', 'true')
    expect(screen.getByText('Copy').closest('[data-done]')).toHaveAttribute('data-done', 'false')
  })

  it('shows the X of Y count when progress is on', () => {
    render(<PublicChecklistElement element={el()} />)
    expect(screen.getByText(/1 of 2/i)).toBeInTheDocument()
  })

  it('hides the progress bar when checklistShowProgress is false', () => {
    render(<PublicChecklistElement element={el({ checklistShowProgress: false })} />)
    expect(screen.queryByText(/of 2/i)).not.toBeInTheDocument()
  })

  it('renders an empty state, not a broken bar, when there are no items', () => {
    render(<PublicChecklistElement element={el({ checklistItems: [] })} />)
    expect(screen.getByText(/no items yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/of 0/i)).not.toBeInTheDocument()
  })
})
