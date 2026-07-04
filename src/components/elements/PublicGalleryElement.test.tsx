import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PublicGalleryElement } from './PublicGalleryElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement>): CanvasElement => ({ id: '1', type: 'gallery', ...over })

describe('PublicGalleryElement', () => {
  const imgs = [
    { url: 'https://a.com/1.jpg', caption: 'One' },
    { url: 'https://a.com/2.jpg', caption: 'Two' },
  ]
  it('renders a thumbnail per image', () => {
    render(<PublicGalleryElement element={el({ galleryImages: imgs })} />)
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })
  it('opens a lightbox on click and closes it', () => {
    render(<PublicGalleryElement element={el({ galleryImages: imgs })} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: /view image/i })[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
