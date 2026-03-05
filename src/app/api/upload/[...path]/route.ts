import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
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

    // Validate file extension is an allowed image type
    const ext = path.extname(filepath).toLowerCase()
    if (!MIME_TYPES[ext]) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 403 })
    }

    // Check if file exists
    if (!existsSync(filepath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Read file
    const buffer = await readFile(filepath)
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

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
