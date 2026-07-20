import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ count: 0 })

  const rows = await db.conversationParticipant.findMany({
    where: { userId: user.id, state: 'accepted' },
    select: { conversationId: true, lastReadAt: true },
    take: 100,
  })

  const counts = await Promise.all(
    rows.map((row) =>
      db.directMessage.count({
        where: {
          conversationId: row.conversationId,
          senderId: { not: user.id },
          deletedAt: null,
          ...(row.lastReadAt ? { createdAt: { gt: row.lastReadAt } } : {}),
        },
        take: 1,
      })
    )
  )

  // The badge counts conversations with unread messages, matching the number
  // shown on the Unread filter tab.
  return NextResponse.json({ count: counts.filter((c) => c > 0).length })
}
