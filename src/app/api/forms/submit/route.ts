import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createHash } from 'crypto'
import { getJwtSecret } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { ingestLead } from '@/lib/crm/ingest'
import { sniffFormContact } from '@/lib/crm/email'

// Ceiling on the JSON we copy into CrmActivity.payload. Past this we keep a
// pointer to the FormResponse row instead of the answers themselves.
const MAX_PAYLOAD_BYTES = 20_000

function boundedPayload(responses: unknown, formResponseId: string): Record<string, unknown> {
  try {
    const serialized = JSON.stringify(responses)
    if (serialized && serialized.length <= MAX_PAYLOAD_BYTES) return { responses }
  } catch {
    // Circular or otherwise unserializable — fall through to the pointer.
  }
  return { truncated: true, formResponseId }
}

export async function POST(request: NextRequest) {
  // 30 form submissions per minute per IP
  const limited = await rateLimit(request, { limit: 30, windowMs: 60_000, prefix: 'form-submit' })
  if (limited) return limited

  try {
    const body = await request.json()
    const { displayId, sessionId, responses } = body

    if (!displayId) {
      return NextResponse.json({ error: 'displayId is required' }, { status: 400 })
    }

    if (!responses || typeof responses !== 'object' || Array.isArray(responses)) {
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

    const sniffed = sniffFormContact(responses)
    await ingestLead({
      displayId,
      email: sniffed.email,
      name: sniffed.name,
      source: 'form',
      sourceId: formResponse.id,
      summary: 'Submitted a form',
      // Bounded copy only. This route is unauthenticated and `responses` is
      // whatever the visitor posted, so storing it verbatim doubled the
      // storage of every submission and handed an attacker an unbounded JSONB
      // write. The full answers already live on the FormResponse row; the CRM
      // timeline only needs enough to recognise the touch.
      payload: boundedPayload(responses, formResponse.id),
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      responseId: formResponse.id,
    })
  } catch (error) {
    console.error('Form submission error:', error)
    return NextResponse.json({ error: 'Failed to submit form' }, { status: 500 })
  }
}
