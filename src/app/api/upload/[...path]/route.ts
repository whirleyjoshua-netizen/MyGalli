import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { mimeForExtension } from '@/lib/upload-validate'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

// Serve exactly what upload-validate lets people upload — no second hand-kept
// list. `.jpeg` is the one alias the writer never produces (it normalises to
// .jpg) but older stored files may still use, so it is mapped explicitly.
// `.svg` is deliberately NOT served: it is not an accepted upload type and
// serving it invites stored-XSS.
const EXTRA_MIME_TYPES: Record<string, string> = {
  '.jpeg': 'image/jpeg',
}

function contentTypeFor(ext: string): string | undefined {
  return mimeForExtension(ext) || EXTRA_MIME_TYPES[ext]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params

    if (!pathSegments || pathSegments.length < 2) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // Sanitize path to prevent directory traversal
    const sanitizedPath = pathSegments.map((segment) =>
      segment.replace(/[^a-zA-Z0-9._-]/g, '')
    )

    const filepath = path.join(UPLOAD_DIR, ...sanitizedPath)

    // Ensure the path is within the upload directory
    const realUploadDir = path.resolve(UPLOAD_DIR)
    const realFilepath = path.resolve(filepath)

    if (!realFilepath.startsWith(realUploadDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 })
    }

    // Validate the extension is something we accept on upload
    const ext = path.extname(filepath).toLowerCase()
    const contentType = contentTypeFor(ext)
    if (!contentType) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 403 })
    }

    // Check if file exists
    if (!existsSync(filepath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Read file
    const buffer = await readFile(filepath)

    // Return file with security headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'",
      },
    })
  } catch (error) {
    console.error('File serve error:', error)
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}
