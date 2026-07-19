import { describe, it, expect } from 'vitest'
import { validateDropInput, toDropDTO, dropPathPrefix, isOwnDropAsset } from './hub-drops'

const BLOB = 'https://abc123.public.blob.vercel-storage.com/hub-drops/h1'

describe('validateDropInput', () => {
  it('accepts a valid image drop', () => {
    const r = validateDropInput('h1', { type: 'image', url: `${BLOB}/x.jpg`, caption: 'hi' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.type).toBe('image')
      expect(r.value.url).toBe(`${BLOB}/x.jpg`)
      expect(r.value.caption).toBe('hi')
      expect(r.value.thumbnailUrl).toBeNull()
    }
  })

  it('accepts a video drop with thumbnail + dimensions', () => {
    const r = validateDropInput('h1', { type: 'video', url: `${BLOB}/x.mp4`, thumbnailUrl: `${BLOB}/x.jpg`, width: 720, height: 1280, mimeType: 'video/mp4' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.width).toBe(720)
      expect(r.value.mimeType).toBe('video/mp4')
    }
  })

  // A drop URL is rendered as <img src>/<video src> to every hub visitor. The Blob
  // token route is the upload authz boundary, but a member can POST straight to
  // /drops and skip it — so the create route must re-check the host itself.
  it('rejects a url that is not a Vercel Blob asset', () => {
    expect(validateDropInput('h1', { type: 'image', url: 'https://attacker.example/tracker.gif' }))
      .toEqual({ ok: false, error: 'A file URL is required' })
  })

  it('rejects a non-https blob-lookalike host', () => {
    expect(validateDropInput('h1', { type: 'image', url: 'http://x.public.blob.vercel-storage.com/y.jpg' }))
      .toEqual({ ok: false, error: 'A file URL is required' })
  })

  it('rejects a host that merely contains the blob domain', () => {
    expect(validateDropInput('h1', { type: 'image', url: 'https://public.blob.vercel-storage.com.evil.test/y.jpg' }))
      .toEqual({ ok: false, error: 'A file URL is required' })
  })

  it('rejects an off-host thumbnailUrl even when the url is valid', () => {
    expect(validateDropInput('h1', { type: 'video', url: `${BLOB}/x.mp4`, thumbnailUrl: 'https://attacker.example/t.jpg' }))
      .toEqual({ ok: false, error: 'A file URL is required' })
  })

  it('rejects a javascript: url', () => {
    expect(validateDropInput('h1', { type: 'image', url: 'javascript:alert(1)' }))
      .toEqual({ ok: false, error: 'A file URL is required' })
  })

  // The delete route hard-deletes a drop's blob with the app-wide RW token, and one
  // Blob store backs avatars/page images/message media/hub files. Without a per-hub
  // path scope, anyone could file another user's asset as their own drop and then
  // delete it. The blob host alone is NOT sufficient proof of ownership.
  it('rejects a blob url belonging to another hub', () => {
    expect(validateDropInput('h1', { type: 'image', url: 'https://abc123.public.blob.vercel-storage.com/hub-drops/h2/x.jpg' }))
      .toEqual({ ok: false, error: 'A file URL is required' })
  })

  it('rejects a blob url outside the drops namespace (avatar, hub file, message media)', () => {
    expect(validateDropInput('h1', { type: 'image', url: 'https://abc123.public.blob.vercel-storage.com/avatars/victim.jpg' }))
      .toEqual({ ok: false, error: 'A file URL is required' })
  })

  it('rejects a hub-id prefix match that is not a path segment', () => {
    expect(validateDropInput('h1', { type: 'image', url: 'https://abc123.public.blob.vercel-storage.com/hub-drops/h1evil/x.jpg' }))
      .toEqual({ ok: false, error: 'A file URL is required' })
  })

  it('rejects a traversal attempt out of the hub namespace', () => {
    expect(validateDropInput('h1', { type: 'image', url: 'https://abc123.public.blob.vercel-storage.com/hub-drops/h1/../h2/x.jpg' }))
      .toEqual({ ok: false, error: 'A file URL is required' })
  })

  it('rejects an off-hub thumbnailUrl even when the url is in-hub', () => {
    expect(validateDropInput('h1', { type: 'video', url: `${BLOB}/x.mp4`, thumbnailUrl: 'https://abc123.public.blob.vercel-storage.com/avatars/victim.jpg' }))
      .toEqual({ ok: false, error: 'A file URL is required' })
  })
})

describe('dropPathPrefix / isOwnDropAsset', () => {
  it('namespaces uploads per hub', () => {
    expect(dropPathPrefix('h1')).toBe('hub-drops/h1/')
  })

  it('accepts only assets under this hub prefix', () => {
    expect(isOwnDropAsset('h1', `${BLOB}/x.jpg`)).toBe(true)
    expect(isOwnDropAsset('h1', 'https://abc123.public.blob.vercel-storage.com/hub-drops/h2/x.jpg')).toBe(false)
    expect(isOwnDropAsset('h1', 'https://abc123.public.blob.vercel-storage.com/avatars/v.jpg')).toBe(false)
    expect(isOwnDropAsset('h1', 'not a url')).toBe(false)
  })

  it('rejects an unknown type', () => {
    expect(validateDropInput('h1', { type: 'link', url: 'https://x' })).toEqual({ ok: false, error: 'Invalid drop type' })
  })

  it('rejects a missing url', () => {
    expect(validateDropInput('h1', { type: 'image', url: '' })).toEqual({ ok: false, error: 'A file URL is required' })
  })

  it('rejects a non-string url', () => {
    expect(validateDropInput('h1', { type: 'image', url: 123 })).toEqual({ ok: false, error: 'A file URL is required' })
  })

  it('truncates an overlong caption to 500 chars', () => {
    const r = validateDropInput('h1', { type: 'image', url: `${BLOB}/y.jpg`, caption: 'a'.repeat(600) })
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
