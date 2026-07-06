import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicWhiteboardElement } from './PublicWhiteboardElement'
import type { CanvasElement } from '@/lib/types/canvas'

const base: CanvasElement = { id: 'w1', type: 'whiteboard', whiteboardWidth: 800, whiteboardHeight: 450 }

describe('PublicWhiteboardElement', () => {
  it('renders an img with the preview url', () => {
    render(<PublicWhiteboardElement element={{ ...base, whiteboardPreviewUrl: 'https://blob/x.png' }} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://blob/x.png')
  })
  it('renders nothing when there is no preview', () => {
    const { container } = render(<PublicWhiteboardElement element={{ ...base, whiteboardPreviewUrl: '' }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
