import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isBulletinBlockType, normalizeSettings, isEmptyPost } from '@/lib/bulletin'

export async function POST(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const text: string | null = typeof body.text === 'string' && body.text.trim() ? body.text.trim().slice(0, 2000) : null
    const imageUrl: string | null = typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null
    const block = body.block && typeof body.block === 'object' ? body.block : null

    if (block) {
      if (!isBulletinBlockType(block.type)) {
        return NextResponse.json({ error: 'Unsupported block type' }, { status: 400 })
      }
      if (typeof block.id !== 'string' || !block.id) {
        block.id = `blk-${me.id.slice(-4)}-${text ? text.length : 0}-${Math.round(1000 * (block.type.length))}`
      }
    }

    if (isEmptyPost({ text, imageUrl, block })) {
      return NextResponse.json({ error: 'Post is empty' }, { status: 400 })
    }

    const post = await db.bulletinPost.create({
      data: {
        authorId: me.id,
        text,
        imageUrl,
        blocks: block ? [block] : [],
        settings: normalizeSettings(body.settings) as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    })

    return NextResponse.json({ id: post.id }, { status: 201 })
  } catch (error) {
    console.error('Bulletin create error:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}
