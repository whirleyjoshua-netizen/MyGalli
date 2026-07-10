import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { getJwtSecret } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { createNotification } from '@/lib/notifications'
import { isAllowedMessageMedia } from '@/lib/media-url'

// POST — public submit to a user's profile mailbox (no owning page)
export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'messages-submit' })
  if (limited) return limited

  let b: Record<string, unknown>
  try { b = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  // Honeypot: silently accept, do not persist.
  if (typeof b.hp === 'string' && b.hp.trim() !== '') return NextResponse.json({ ok: true })

  const username = String(b.username ?? '').trim()
  const kind = b.kind === 'audio' ? 'audio' : 'text'
  const body = typeof b.body === 'string' ? b.body.trim() : ''
  const mediaUrl = typeof b.mediaUrl === 'string' ? b.mediaUrl : ''
  const senderName = typeof b.senderName === 'string' ? b.senderName.trim() : ''
  const senderEmail = typeof b.senderEmail === 'string' ? b.senderEmail.trim() : ''

  if (!username) return NextResponse.json({ error: 'Missing target' }, { status: 400 })
  if (!body && !mediaUrl) return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  if (!isAllowedMessageMedia(mediaUrl)) return NextResponse.json({ error: 'Invalid media' }, { status: 400 })

  const user = await db.user.findUnique({ where: { username }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const ipHash = createHash('sha256').update(ip + getJwtSecret()).digest('hex').substring(0, 16)

  await db.message.create({
    data: {
      displayId: null, ownerId: user.id, elementId: 'profile-mailbox', kind,
      body: body || null, mediaUrl: mediaUrl || null,
      senderName: senderName || null, senderEmail: senderEmail || null, ipHash,
    },
  })

  await createNotification({
    userId: user.id, type: 'message',
    actor: { id: null, name: senderName || 'Someone' },
    entityUrl: '/data?tab=messages', contextText: 'Profile mailbox',
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
