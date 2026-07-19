import { describe, it, expect } from 'vitest'
import { validateDropInput, toDropDTO } from './hub-drops'

describe('validateDropInput', () => {
  it('accepts a valid image drop', () => {
    const r = validateDropInput({ type: 'image', url: 'https://blob.example/x.jpg', caption: 'hi' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.type).toBe('image')
      expect(r.value.url).toBe('https://blob.example/x.jpg')
      expect(r.value.caption).toBe('hi')
      expect(r.value.thumbnailUrl).toBeNull()
    }
  })

  it('accepts a video drop with thumbnail + dimensions', () => {
    const r = validateDropInput({ type: 'video', url: 'https://blob.example/x.mp4', thumbnailUrl: 'https://blob.example/x.jpg', width: 720, height: 1280, mimeType: 'video/mp4' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.width).toBe(720)
      expect(r.value.mimeType).toBe('video/mp4')
    }
  })

  it('rejects an unknown type', () => {
    expect(validateDropInput({ type: 'link', url: 'https://x' })).toEqual({ ok: false, error: 'Invalid drop type' })
  })

  it('rejects a missing url', () => {
    expect(validateDropInput({ type: 'image', url: '' })).toEqual({ ok: false, error: 'A file URL is required' })
  })

  it('rejects a non-string url', () => {
    expect(validateDropInput({ type: 'image', url: 123 })).toEqual({ ok: false, error: 'A file URL is required' })
  })

  it('truncates an overlong caption to 500 chars', () => {
    const r = validateDropInput({ type: 'image', url: 'https://x/y.jpg', caption: 'a'.repeat(600) })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.caption?.length).toBe(500)
  })
})

describe('toDropDTO', () => {
  it('maps a row + author to a DTO with iso date', () => {
    const dto = toDropDTO({
      id: 'd1', type: 'video', url: 'u', thumbnailUrl: 't', caption: 'c', mimeType: 'video/mp4',
      width: 1, height: 2, hidden: false, createdAt: new Date('2026-07-19T00:00:00.000Z'),
      author: { id: 'u1', username: 'joe', name: 'Joe', avatar: null },
    })
    expect(dto).toEqual({
      id: 'd1', type: 'video', url: 'u', thumbnailUrl: 't', caption: 'c', mimeType: 'video/mp4',
      width: 1, height: 2, hidden: false, createdAt: '2026-07-19T00:00:00.000Z',
      author: { userId: 'u1', username: 'joe', name: 'Joe', avatar: null },
    })
  })
})
