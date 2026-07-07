import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/storage-env', () => ({ blobReadWriteToken: () => null })) // force local path; gating returns before fs anyway
vi.mock('@/lib/upload-validate', () => ({
  validateUpload: (type: string) => (type.startsWith('audio/') ? { ok: true } : { ok: false, error: 'bad' }),
  extensionForMime: () => '.webm',
}))

import { POST } from './route'

function withFile(file: File | null): NextRequest {
  const fd = new FormData()
  if (file) fd.append('file', file)
  return new NextRequest('http://localhost/api/messages/upload', { method: 'POST', body: fd })
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/messages/upload', () => {
  it('400 when no file', async () => {
    const res = await POST(withFile(null))
    expect(res.status).toBe(400)
  })
  it('400 when the file is not audio', async () => {
    const res = await POST(withFile(new File(['x'], 'a.png', { type: 'image/png' })))
    expect(res.status).toBe(400)
  })
})
