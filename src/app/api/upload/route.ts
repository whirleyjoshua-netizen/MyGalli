import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getUser } from '@/lib/auth'
import { blobReadWriteToken } from '@/lib/storage-env'
import { validateUpload, extensionForMime } from '@/lib/upload-validate'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const check = validateUpload(file.type, file.size)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }

    // Use Vercel Blob in production (when a Blob read-write token is present)
    const blobToken = blobReadWriteToken()
    if (blobToken) {
      const { put } = await import('@vercel/blob')
      const ext = path.extname(file.name) || extensionForMime(file.type)
      const blobPath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`

      const blob = await put(blobPath, file, {
        access: 'public',
        contentType: file.type,
        token: blobToken,
      })

      return NextResponse.json({ url: blob.url, filename: path.basename(blob.url) })
    }

    // Local file storage (development)
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }

    const userDir = path.join(UPLOAD_DIR, user.id)
    if (!existsSync(userDir)) {
      await mkdir(userDir, { recursive: true })
    }

    const ext = path.extname(file.name) || extensionForMime(file.type)
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`
    const filepath = path.join(userDir, filename)

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    const url = `/api/upload/${user.id}/${filename}`

    return NextResponse.json({ url, filename })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}

