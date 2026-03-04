import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createHash } from 'crypto'
import { getJwtSecret } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // 30 form submissions per minute per IP
  const limited = rateLimit(request, { limit: 30, windowMs: 60_000, prefix: 'form-submit' })
  if (limited) return limited

  try {
    const body = await request.json()
    const { displayId, sessionId, responses } = body

    if (!displayId) {
      return NextResponse.json({ error: 'displayId is required' }, { status: 400 })
    }

    if (!responses || typeof responses !== 'object') {
      return NextResponse.json({ error: 'responses is required' }, { status: 400 })
    }

    // Verify display exists and is published
    const display = await db.display.findUnique({
      where: { id: displayId },
      select: { id: true, published: true },
    })

    if (!display) {
      return NextResponse.json({ error: 'Display not found' }, { status: 404 })
    }

    if (!display.published) {
      return NextResponse.json({ error: 'Display not published' }, { status: 403 })
    }

    // Get user agent and hash IP for spam prevention
    const userAgent = request.headers.get('user-agent')
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ip = forwardedFor?.split(',')[0] || 'unknown'
    const ipHash = createHash('sha256').update(ip + getJwtSecret()).digest('hex').substring(0, 16)

    // Create form response
    const formResponse = await db.formResponse.create({
      data: {
        displayId,
        sessionId,
        responses,
        userAgent,
        ipHash,
      },
    })

    return NextResponse.json({
      success: true,
      responseId: formResponse.id,
    })
  } catch (error) {
    console.error('Form submission error:', error)
    return NextResponse.json({ error: 'Failed to submit form' }, { status: 500 })
  }
}
