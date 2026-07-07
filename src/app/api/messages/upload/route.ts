import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { rateLimit } from '@/lib/rate-limit'
import { blobReadWriteToken } from '@/lib/storage-env'
import { validateUpload, extensionForMime } from '@/lib/upload-validate'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

// Public (unauthenticated) audio upload for mailbox voice messages. Rate-limited,
// audio-only, size-capped via validateUpload. Stored under a non-user `messages/` prefix.
// (The owner-only /api/upload cannot be used by anonymous visitors.)
export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 10, windowMs: 60_000, prefix: 'messages-upload' })
  if (limited) return limited
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!file.type.startsWith('audio/')) return NextResponse.json({ error: 'Audio files only' }, { status: 400 })
    const check = validateUpload(file.type, file.size)
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

    const ext = path.extname(file.name) || extensionForMime(file.type)
    const name = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`

    const blobToken = blobReadWriteToken()
    if (blobToken) {
      const { put } = await import('@vercel/blob')
      const blob = await put(`messages/${name}`, file, { access: 'public', contentType: file.type, token: blobToken })
      return NextResponse.json({ url: blob.url })
    }

    // Local dev fallback (served by the existing GET /api/upload/[...] handler).
    const dir = path.join(UPLOAD_DIR, 'messages')
    if (!existsSync(dir)) await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()))
    return NextResponse.json({ url: `/api/upload/messages/${name}` })
  } catch (e) {
    console.error('message upload error', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
