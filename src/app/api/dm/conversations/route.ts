import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { conversationKey, initialParticipantState } from '@/lib/dm'
import type { DmConversationSummary, DmMessageKind, DmParticipantState } from '@/lib/types/dm'

const PAGE_SIZE = 30

export async function GET(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Presence heartbeat rides along with the list poll -- no separate endpoint.
  await db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })

  const filter = request.nextUrl.searchParams.get('filter') || 'all'
  const state = filter === 'requests' ? 'requested' : 'accepted'

  const rows = await db.conversationParticipant.findMany({
    where: { userId: user.id, state },
    orderBy: { conversation: { lastMessageAt: 'desc' } },
    take: PAGE_SIZE,
    include: {
      conversation: {
        include: {
          participants: {
            where: { userId: { not: user.id } },
            include: {
              user: {
                select: { id: true, username: true, name: true, avatar: true, lastSeenAt: true },
              },
            },
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  // One query answers "which of these people follow me" for the whole page,
  // rather than a follow lookup per conversation.
  const otherIds = rows
    .map((r) => r.conversation.participants[0]?.userId)
    .filter((v): v is string => !!v)
  const followBack = await db.follow.findMany({
    where: { followingId: user.id, followerId: { in: otherIds } },
    select: { followerId: true },
  })
  const followers = new Set(followBack.map((f) => f.followerId))

  // Unread is per-participant, so each row needs its own count against its own
  // lastReadAt. Bounded by PAGE_SIZE and served by the
  // (conversationId, createdAt) index; revisit if the page size grows.
  const counts = await Promise.all(
    rows.map((row) =>
      db.directMessage.count({
        where: {
          conversationId: row.conversationId,
          senderId: { not: user.id },
          deletedAt: null,
          ...(row.lastReadAt ? { createdAt: { gt: row.lastReadAt } } : {}),
        },
      })
    )
  )

  const conversations: DmConversationSummary[] = rows.map((row, i) => {
    const other = row.conversation.participants[0]?.user
    const last = row.conversation.messages[0]
    return {
      id: row.conversationId,
      state: row.state as DmParticipantState,
      starred: row.starred,
      muted: row.muted,
      unreadCount: counts[i],
      lastMessageAt: row.conversation.lastMessageAt.toISOString(),
      other: {
        id: other?.id ?? '',
        username: other?.username ?? '',
        name: other?.name ?? null,
        avatar: other?.avatar ?? null,
        lastSeenAt: other?.lastSeenAt ? other.lastSeenAt.toISOString() : null,
        followsYou: other ? followers.has(other.id) : false,
      },
      preview: last
        ? {
            body: last.body,
            kind: last.kind as DmMessageKind,
            senderId: last.senderId,
            createdAt: last.createdAt.toISOString(),
          }
        : null,
    }
  })

  const filtered = filter === 'unread' ? conversations.filter((c) => c.unreadCount > 0) : conversations

  return NextResponse.json({ conversations: filtered })
}

export async function POST(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await rateLimit(request, {
    limit: 20,
    windowMs: 60_000,
    prefix: 'dm-create',
    identifier: user.id,
  })
  if (limited) return limited

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const username = typeof body.username === 'string' ? body.username.trim() : ''
  if (!username) return NextResponse.json({ error: 'Missing username' }, { status: 400 })

  const target = await db.user.findUnique({ where: { username }, select: { id: true } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (target.id === user.id) {
    return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })
  }

  const key = conversationKey(user.id, target.id)

  const existing = await db.conversation.findUnique({ where: { key }, select: { id: true } })
  if (existing) return NextResponse.json({ id: existing.id })

  const follows = await db.follow.findFirst({
    where: { followerId: target.id, followingId: user.id },
    select: { id: true },
  })
  // Conversation.key is unique per user pair, and we only reach here because the query
  // at line 136 confirmed no conversation exists yet, so there cannot be prior accepted history.
  const recipientState = initialParticipantState({
    recipientFollowsSender: !!follows,
    hasAcceptedHistory: false,
  })

  try {
    const created = await db.conversation.create({
      data: {
        key,
        participants: {
          create: [
            { userId: user.id, state: 'accepted' },
            { userId: target.id, state: recipientState },
          ],
        },
      },
      select: { id: true },
    })
    return NextResponse.json({ id: created.id }, { status: 201 })
  } catch (e) {
    // Someone else won the race on the unique key -- use their conversation.
    if ((e as { code?: string }).code === 'P2002') {
      const winner = await db.conversation.findUnique({ where: { key }, select: { id: true } })
      if (winner) return NextResponse.json({ id: winner.id })
    }
    throw e
  }
}
