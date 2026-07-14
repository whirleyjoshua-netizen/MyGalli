import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { sanitizeInterests, sanitizeLinks } from '@/lib/profile'

export async function PATCH(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string') data.name = body.name.trim().slice(0, 80)
    if (typeof body.bio === 'string') data.bio = body.bio.slice(0, 500)
    if (typeof body.location === 'string') data.location = body.location.trim().slice(0, 120)
    if (typeof body.avatar === 'string') data.avatar = body.avatar
    if (typeof body.coverImage === 'string') data.coverImage = body.coverImage
    if (body.interests !== undefined) data.interests = sanitizeInterests(body.interests)
    if (body.links !== undefined) data.links = sanitizeLinks(body.links)

    if (body.featuredDisplayId !== undefined) {
      if (body.featuredDisplayId === null) {
        data.featuredDisplayId = null
      } else {
        const d = await db.display.findUnique({
          where: { id: String(body.featuredDisplayId) },
          select: { userId: true, published: true },
        })
        data.featuredDisplayId = d && d.userId === me.id && d.published ? String(body.featuredDisplayId) : null
      }
    }

    const updated = await db.user.update({
      where: { id: me.id },
      data,
      select: {
        id: true, username: true, name: true, avatar: true, coverImage: true, bio: true,
        location: true, interests: true, links: true, emailVerified: true, featuredDisplayId: true,
      },
    })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('Profile update error:', e)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
