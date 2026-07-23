import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { CanvasElement } from '@/lib/types/canvas'
import { renderElement } from './render-elements'
import { ColumnCanvas } from '@/components/canvas/ColumnCanvas'

const STAMP = { stampedAt: '2026-07-23T23:30:00.000Z', stampedTz: 'UTC' }

describe('renderElement stamp wrapper', () => {
  it('renders no stamp when the element is unstamped', () => {
    render(<div>{renderElement({ id: 'e1', type: 'text', content: 'hello' })}</div>)
    expect(screen.queryByRole('time')).not.toBeInTheDocument()
  })

  it('renders the stamp when present', () => {
    render(<div>{renderElement({ id: 'e1', type: 'text', content: 'hello', ...STAMP })}</div>)
    expect(screen.getByRole('time')).toHaveAttribute('datetime', STAMP.stampedAt)
  })

  it('still renders the element body alongside the stamp', () => {
    render(<div>{renderElement({ id: 'e1', type: 'heading', content: 'My Heading', ...STAMP })}</div>)
    expect(screen.getByText('My Heading')).toBeInTheDocument()
    expect(screen.getByRole('time')).toBeInTheDocument()
  })

  // The point of the wrapper: it is type-independent. If someone ever moves the
  // stamp into the switch, this is the test that catches it.
  it.each(['text', 'heading', 'image', 'quote', 'code'] as const)(
    'renders the stamp for a %s element',
    (type) => {
      const el = { id: 'e1', type, content: 'x', url: 'https://x/a.jpg', quoteText: 'q', ...STAMP } as CanvasElement
      render(<div>{renderElement(el)}</div>)
      expect(screen.getByRole('time')).toBeInTheDocument()
    },
  )
})

describe('editor canvas stamp', () => {
  it('renders the stamp on the canvas so the author sees what a visitor sees', () => {
    const sections = [{ id: 's1', layout: 'full-width' as const, columns: [
      { id: 'c1', elements: [{ id: 'e1', type: 'text' as const, content: 'hi', ...STAMP }] },
    ] }]
    render(
      <ColumnCanvas
        sections={sections}
        onSectionsChange={() => {}}
        onAddSection={() => {}}
        onDeleteSection={() => {}}
        onOpenSlashMenu={() => {}}
        onUpdateElement={() => {}}
        onDeleteElement={() => {}}
        displayId="d1"
      />,
    )
    expect(screen.getByRole('time')).toBeInTheDocument()
  })
})
