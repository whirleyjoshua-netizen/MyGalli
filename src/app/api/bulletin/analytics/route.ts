import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { aggregateBlock, toRecords } from '@/lib/element-aggregate'

export async function GET(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const posts = await db.bulletinPost.findMany({
      where: { authorId: me.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        text: true,
        createdAt: true,
        blocks: true,
        responses: {
          select: { userId: true, responses: true, createdAt: true, user: { select: { name: true, username: true, avatar: true } } },
        },
      },
    })

    const out = posts
      .map((p) => {
        const blocks = Array.isArray(p.blocks) ? (p.blocks as any[]) : []
        const block = blocks[0] || null
        if (!block) return null
        const results = aggregateBlock(block, toRecords(p.responses))
        if (!results) return null
        return { id: p.id, createdAt: p.createdAt.toISOString(), text: p.text, results }
      })
      .filter(Boolean)

    return NextResponse.json({ posts: out })
  } catch (error) {
    console.error('Bulletin analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch bulletin analytics' }, { status: 500 })
  }
}
