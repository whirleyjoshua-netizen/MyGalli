import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import KollabReelPlayer, { type Reel } from './KollabReelPlayer'

const clip = (over: Partial<Reel['clips'][number]> = {}): Reel['clips'][number] => ({
  dropId: 'd1', in: 0, out: 3, type: 'video',
  url: 'https://blob/x.mp4', thumbnailUrl: 'https://blob/x.jpg',
  caption: null, author: 'maria', ...over,
})

const reel = (over: Partial<Reel> = {}): Reel => ({
  id: 'r1', title: 'Saturday at the field', status: 'published', runtimeSec: 6,
  createdAt: '2026-07-22T00:00:00.000Z', creator: { username: 'm' },
  clips: [clip(), clip({ dropId: 'd2', type: 'image', url: 'https://blob/y.jpg' })],
  ...over,
})

describe('KollabReelPlayer', () => {
  it('shows the title', () => {
    render(<KollabReelPlayer reel={reel()} onClose={() => {}} />)
    expect(screen.getByText('Saturday at the field')).toBeInTheDocument()
  })

  it('renders the first clip as a video element', () => {
    const { container } = render(<KollabReelPlayer reel={reel()} onClose={() => {}} />)
    expect(container.querySelector('video')?.getAttribute('src')).toBe('https://blob/x.mp4')
  })

  it('renders an image clip as an img when it leads', () => {
    const r = reel({ clips: [clip({ type: 'image', url: 'https://blob/y.jpg' })] })
    const { container } = render(<KollabReelPlayer reel={r} onClose={() => {}} />)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://blob/y.jpg')
  })

  it('credits the current clip author', () => {
    render(<KollabReelPlayer reel={reel()} onClose={() => {}} />)
    expect(screen.getByText('@maria')).toBeInTheDocument()
  })

  it('calls onClose from the close button', () => {
    const onClose = vi.fn()
    render(<KollabReelPlayer reel={reel()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(<KollabReelPlayer reel={reel()} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows an empty state when every clip has been moderated away', () => {
    render(<KollabReelPlayer reel={reel({ clips: [] })} onClose={() => {}} />)
    expect(screen.getByText(/no longer available/i)).toBeInTheDocument()
  })

  it('starts muted so autoplay is allowed', () => {
    const { container } = render(<KollabReelPlayer reel={reel()} onClose={() => {}} />)
    expect(container.querySelector('video')?.muted).toBe(true)
  })

  it('offers an unmute control', () => {
    render(<KollabReelPlayer reel={reel()} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /unmute/i })).toBeInTheDocument()
  })
})
