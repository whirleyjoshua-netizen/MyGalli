import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import KollabReelPlayer, { type Reel } from './KollabReelPlayer'

const clip = (over: Partial<Reel['clips'][number]> = {}): Reel['clips'][number] => ({
  dropId: 'd1', in: 0, out: 3, type: 'video',
  url: 'https://blob/x.mp4', thumbnailUrl: 'https://blob/x.jpg',
  caption: null, author: 'maria', ...over,
})

const reel = (over: Partial<Reel> = {}): Reel => ({
  id: 'r1', title: 'Saturday at the field', status: 'published', runtimeSec: 6,
  createdAt: '2026-07-22T00:00:00.000Z', creatorId: 'member', creator: { username: 'm' },
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

  it('advances exactly one clip when timeupdate crosses out', () => {
    const r = reel({
      clips: [
        clip({ dropId: 'd1', out: 3, url: 'https://blob/first.mp4' }),
        clip({ dropId: 'd2', type: 'image', url: 'https://blob/second.jpg' }),
        clip({ dropId: 'd3', type: 'image', url: 'https://blob/third.jpg' }),
      ],
    })
    const { container } = render(<KollabReelPlayer reel={r} onClose={() => {}} />)
    const video = container.querySelector('video') as HTMLVideoElement
    Object.defineProperty(video, 'currentTime', { value: 3, writable: true })
    fireEvent.timeUpdate(video)

    // Must land on the second clip, not the third — proves next() is not
    // double-firing from a single end-of-playback moment.
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://blob/second.jpg')
  })

  it('advances exactly one clip when timeupdate is immediately followed by ended', () => {
    const r = reel({
      clips: [
        clip({ dropId: 'd1', out: 3, url: 'https://blob/first.mp4' }),
        clip({ dropId: 'd2', type: 'image', url: 'https://blob/second.jpg' }),
        clip({ dropId: 'd3', type: 'image', url: 'https://blob/third.jpg' }),
      ],
    })
    const { container } = render(<KollabReelPlayer reel={r} onClose={() => {}} />)
    const video = container.querySelector('video') as HTMLVideoElement
    Object.defineProperty(video, 'currentTime', { value: 3, writable: true })
    // Fire both native events in the same batch (as a real browser does at
    // end-of-playback) so React processes both `next()` calls against the
    // same pre-update state before re-rendering.
    act(() => {
      fireEvent.timeUpdate(video)
      fireEvent.ended(video)
    })

    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://blob/second.jpg')
  })

  it('advances one clip via onEnded alone when out exceeds the real duration', () => {
    const r = reel({
      clips: [
        clip({ dropId: 'd1', out: 9999, url: 'https://blob/first.mp4' }),
        clip({ dropId: 'd2', type: 'image', url: 'https://blob/second.jpg' }),
      ],
    })
    const { container } = render(<KollabReelPlayer reel={r} onClose={() => {}} />)
    const video = container.querySelector('video') as HTMLVideoElement
    fireEvent.ended(video)

    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://blob/second.jpg')
  })

  it('advances an image clip once its timer elapses', () => {
    vi.useFakeTimers()
    try {
      const r = reel({
        clips: [
          clip({ dropId: 'd1', type: 'image', in: 0, out: 1, url: 'https://blob/first.jpg' }),
          clip({ dropId: 'd2', type: 'image', url: 'https://blob/second.jpg' }),
        ],
      })
      const { container } = render(<KollabReelPlayer reel={r} onClose={() => {}} />)
      expect(container.querySelector('img')?.getAttribute('src')).toBe('https://blob/first.jpg')

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(container.querySelector('img')?.getAttribute('src')).toBe('https://blob/second.jpg')
    } finally {
      vi.useRealTimers()
    }
  })

  it('advances past a clip that errors instead of stranding', () => {
    const r = reel({
      clips: [
        clip({ dropId: 'd1', url: 'https://blob/broken.mp4' }),
        clip({ dropId: 'd2', type: 'image', url: 'https://blob/second.jpg' }),
      ],
    })
    const { container } = render(<KollabReelPlayer reel={r} onClose={() => {}} />)
    const video = container.querySelector('video') as HTMLVideoElement
    fireEvent.error(video)

    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://blob/second.jpg')
  })

  it('stops cleanly on the final clip instead of looping', () => {
    const r = reel({
      clips: [
        clip({ dropId: 'd1', out: 3, url: 'https://blob/only.mp4' }),
      ],
    })
    const { container } = render(<KollabReelPlayer reel={r} onClose={() => {}} />)
    const video = container.querySelector('video') as HTMLVideoElement
    fireEvent.ended(video)
    fireEvent.ended(video)

    expect(container.querySelector('video')?.getAttribute('src')).toBe('https://blob/only.mp4')
  })
})
