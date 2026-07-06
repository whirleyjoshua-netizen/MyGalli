import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicAudioPlayerElement } from './PublicAudioPlayerElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement>): CanvasElement => ({ id: '1', type: 'audio-player', ...over })

afterEach(() => vi.restoreAllMocks())

describe('PublicAudioPlayerElement', () => {
  it('renders an <audio> for a file source', () => {
    const { container } = render(<PublicAudioPlayerElement element={el({ audioSourceType: 'file', audioUrl: 'https://a.com/song.mp3', audioTitle: 'Song' })} />)
    const audio = container.querySelector('audio')
    expect(audio).toBeTruthy()
    expect(audio?.getAttribute('src')).toBe('https://a.com/song.mp3')
  })
  it('renders a Spotify iframe with the embed src', () => {
    const { container } = render(<PublicAudioPlayerElement element={el({ audioSourceType: 'spotify', audioUrl: 'https://open.spotify.com/track/abc123' })} />)
    const iframe = container.querySelector('iframe')
    expect(iframe?.getAttribute('src')).toBe('https://open.spotify.com/embed/track/abc123')
  })
  it('does NOT call play() on mount when Auto-start is off', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
    render(<PublicAudioPlayerElement element={el({ audioSourceType: 'file', audioUrl: 'https://a.com/song.mp3', audioAutoStart: false })} />)
    expect(play).not.toHaveBeenCalled()
  })
  it('shows a placeholder for a source with no url', () => {
    render(<PublicAudioPlayerElement element={el({ audioSourceType: 'file', audioUrl: '' })} />)
    expect(screen.getByText(/add a track/i)).toBeInTheDocument()
  })
})
