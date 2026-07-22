import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('fs', () => {
  const existsSync = vi.fn().mockReturnValue(true)
  return { existsSync, default: { existsSync } }
})
vi.mock('fs/promises', () => {
  const readFile = vi.fn().mockResolvedValue(Buffer.from('bytes'))
  return { readFile, default: { readFile } }
})

import { GET } from './route'

const req = () => new NextRequest('http://localhost/api/upload/u1/f')
const ctx = (segments: string[]) => ({ params: Promise.resolve({ path: segments }) })

beforeEach(() => vi.clearAllMocks())

describe('GET /api/upload/[...path]', () => {
  // The writer (upload-validate) accepts PDF/audio/video, so the reader must
  // serve them. It used to serve images only, which 403'd a Lead Gen PDF and
  // every mailbox voice message in local dev.
  it.each([
    ['a.pdf', 'application/pdf'],
    ['a.png', 'image/png'],
    ['a.jpg', 'image/jpeg'],
    ['a.jpeg', 'image/jpeg'],
    ['a.webp', 'image/webp'],
    ['a.mp3', 'audio/mpeg'],
    ['a.weba', 'audio/webm'],
    ['a.webm', 'video/webm'],
    ['a.mp4', 'video/mp4'],
  ])('serves %s as %s', async (name, expected) => {
    const res = await GET(req(), ctx(['u1', name]))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe(expected)
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('refuses to serve .svg — not an accepted upload type, and stored-XSS bait', async () => {
    const res = await GET(req(), ctx(['u1', 'a.svg']))
    expect(res.status).toBe(403)
  })

  it('rejects an unknown extension', async () => {
    const res = await GET(req(), ctx(['u1', 'a.exe']))
    expect(res.status).toBe(403)
  })

  it('rejects a too-short path', async () => {
    const res = await GET(req(), ctx(['only-one']))
    expect(res.status).toBe(400)
  })
})
