import { describe, it, expect } from 'vitest'
import { hubVideoEmbed } from './hub-video-embed'

describe('hubVideoEmbed', () => {
  it('handles youtube watch + short links', () => {
    expect(hubVideoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ kind: 'youtube', src: 'https://www.youtube.com/embed/dQw4w9WgXcQ' })
    expect(hubVideoEmbed('https://youtu.be/dQw4w9WgXcQ')?.kind).toBe('youtube')
  })
  it('handles vimeo', () => {
    expect(hubVideoEmbed('https://vimeo.com/123456789')).toEqual({ kind: 'vimeo', src: 'https://player.vimeo.com/video/123456789' })
  })
  it('handles direct video files', () => {
    expect(hubVideoEmbed('https://cdn.example.com/clip.mp4')).toEqual({ kind: 'file', src: 'https://cdn.example.com/clip.mp4' })
  })
  it('returns null for empty/unsupported', () => {
    expect(hubVideoEmbed('')).toBeNull()
    expect(hubVideoEmbed(null)).toBeNull()
    expect(hubVideoEmbed('https://example.com/page')).toBeNull()
  })
})
