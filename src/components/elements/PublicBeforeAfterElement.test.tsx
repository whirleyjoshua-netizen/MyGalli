import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicBeforeAfterElement } from './PublicBeforeAfterElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement>): CanvasElement => ({ id: '1', type: 'before-after', ...over })

describe('PublicBeforeAfterElement', () => {
  it('renders both images and the drag handle when both are set', () => {
    render(<PublicBeforeAfterElement element={el({ beforeAfterBefore: 'https://a/b.jpg', beforeAfterAfter: 'https://a/a.jpg' })} />)
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })
  it('shows a placeholder when an image is missing', () => {
    render(<PublicBeforeAfterElement element={el({ beforeAfterBefore: 'https://a/b.jpg' })} />)
    expect(screen.getByText(/add both/i)).toBeInTheDocument()
  })
})
