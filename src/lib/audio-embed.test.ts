// src/lib/audio-embed.test.ts
import { describe, it, expect } from 'vitest'
import { spotifyEmbedUrl, soundcloudEmbedUrl } from './audio-embed'

describe('spotifyEmbedUrl', () => {
  it('converts a track share link (stripping query) to the embed url', () => {
    expect(spotifyEmbedUrl('https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6?si=abc')).toBe('https://open.spotify.com/embed/track/6rqhFgbbKwnb9MLmUQDhG6')
  })
  it('handles album/playlist and locale-prefixed paths', () => {
    expect(spotifyEmbedUrl('https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3')).toBe('https://open.spotify.com/embed/album/1DFixLWuPkv3KT3TnV35m3')
    expect(spotifyEmbedUrl('https://open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M')
  })
  it('returns null for non-spotify or malformed input', () => {
    expect(spotifyEmbedUrl('https://example.com/track/x')).toBeNull()
    expect(spotifyEmbedUrl('not a url')).toBeNull()
  })
})

describe('soundcloudEmbedUrl', () => {
  it('wraps a soundcloud track url in the player embed', () => {
    const out = soundcloudEmbedUrl('https://soundcloud.com/artist/track-name')
    expect(out).toContain('https://w.soundcloud.com/player/?url=')
    expect(out).toContain(encodeURIComponent('https://soundcloud.com/artist/track-name'))
    expect(out).toContain('auto_play=false')
  })
  it('returns null for non-soundcloud input', () => {
    expect(soundcloudEmbedUrl('https://example.com/x')).toBeNull()
  })
})
