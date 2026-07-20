import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { createNotification } from '@/lib/notifications'
import type { DmMessage, DmMessageKind } from '@/lib/types/dm'

const PAGE_SIZE = 30
const MAX_BODY = 4000

type Ctx = { params: Promise<{ id: string }> }

function toWire(m: {
  id: string
  conversationId: string
  senderId: string
  kind: string
  body: string | null
  mediaUrl: string | null
  createdAt: Date
}): DmMessage {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    kind: m.kind as DmMessageKind,
    body: m.body,
    mediaUrl: m.mediaUrl,
    createdAt: m.createdAt.toISOString(),
  }
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Participation is re-verified from the database on every request. A
  // non-participant gets 404 rather than 403 so ids cannot be probed.
  const me = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: user.id } },
    select: { id: true },
  })
  if (!me) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sp = request.nextUrl.searchParams
  const after = sp.get('after')
  const cursor = sp.get('cursor')

  const rows = await db.directMessage.findMany({
    where: {
      conversationId: id,
      deletedAt: null,
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: after ? 'asc' : 'desc' },
    take: PAGE_SIZE,
  })

  // Always hand the client oldest-first; only the query direction differs.
  const ordered = after ? rows : [...rows].reverse()
  return NextResponse.json({ messages: ordered.map(toWire) })
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const me = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: user.id } },
    select: { id: true, state: true },
  })
  if (!me) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const limited = await rateLimit(request, {
    limit: 30,
    windowMs: 60_000,
    prefix: 'dm-send',
    identifier: user.id,
  })
  if (limited) return limited

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const body = typeof payload.body === 'string' ? payload.body.trim() : ''
  if (!body) return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  if (body.length > MAX_BODY) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 })
  }

  const other = await db.conversationParticipant.findFirst({
    where: { conversationId: id, userId: { not: user.id } },
    select: { userId: true, state: true, muted: true, lastReadAt: true },
  })
  if (!other || other.state === 'blocked' || me.state === 'blocked') {
    return NextResponse.json({ error: 'Cannot send to this conversation' }, { status: 403 })
  }

  const created = await db.directMessage.create({
    data: { conversationId: id, senderId: user.id, kind: 'text', body },
  })

  await db.conversation.update({
    where: { id },
    data: { lastMessageAt: created.createdAt },
  })

  // First-unread rule: one notification per thread until they read it again.
  // Without this, a burst of ten messages becomes ten bell rows.
  const unreadFromMe = await db.directMessage.count({
    where: {
      conversationId: id,
      senderId: user.id,
      deletedAt: null,
      ...(other.lastReadAt ? { createdAt: { gt: other.lastReadAt } } : {}),
    },
  })

  if (unreadFromMe === 1 && !other.muted && other.state === 'accepted') {
    await createNotification({
      userId: other.userId,
      type: 'message',
      actor: { id: user.id, name: user.name || user.username },
      entityUrl: `/messages?c=${id}`,
      contextText: body.slice(0, 80),
    })
  }

  return NextResponse.json({ message: toWire(created) }, { status: 201 })
}
