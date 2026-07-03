import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ElementRow } from './ElementRow'

const row = { sectionId: 's1', columnId: 'c1', element: { id: 'e1', type: 'image' as const, url: 'https://x/hero.jpg' } }

describe('ElementRow', () => {
  it('renders the row label and hides inspector when collapsed', () => {
    render(<ElementRow row={row} expanded={false} onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    expect(screen.getByText('Image — hero.jpg')).toBeInTheDocument()
    expect(screen.queryByText(/settings for this element/i)).not.toBeInTheDocument()
  })
  it('calls onToggle when the row header is clicked', () => {
    const onToggle = vi.fn()
    render(<ElementRow row={row} expanded={false} onToggle={onToggle} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Image — hero\.jpg/ }))
    expect(onToggle).toHaveBeenCalled()
  })
  it('renders the ImageInspector when expanded', () => {
    render(<ElementRow row={row} expanded onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    expect(screen.getByLabelText(/image url/i)).toBeInTheDocument()
  })
})
