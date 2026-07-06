import { db } from './db'
import { CATEGORIES } from './categories'

export interface ExploreRowItem {
  id: string
  slug: string
  title: string
  coverImage: string | null
  views: number
  category: string | null
  kind: string
  user: { username: string; name: string | null; avatar: string | null }
}

const CARD_SELECT = {
  id: true, slug: true, title: true, coverImage: true, views: true, category: true, kind: true,
  user: { select: { username: true, name: true, avatar: true } },
} as const

const ROW_LIMIT = 12

function sumViews(items: ExploreRowItem[]): number {
  return items.reduce((total, d) => total + (d.views || 0), 0)
}

export async function getExploreRows(userId?: string): Promise<{
  trending: ExploreRowItem[]
  following: ExploreRowItem[]
  categories: { id: string; label: string; displays: ExploreRowItem[] }[]
}> {
  const baseWhere = { published: true, kind: { not: 'profile' } }

  const trending = await db.display.findMany({ where: baseWhere, orderBy: { views: 'desc' }, take: ROW_LIMIT, select: CARD_SELECT })

  // Row 2 — pages from people the signed-in user follows (empty when logged out).
  let following: ExploreRowItem[] = []
  if (userId) {
    const follows = await db.follow.findMany({ where: { followerId: userId }, select: { followingId: true } })
    const followingIds = follows.map((f) => f.followingId)
    if (followingIds.length > 0) {
      following = await db.display.findMany({
        where: { ...baseWhere, userId: { in: followingIds } },
        orderBy: { createdAt: 'desc' },
        take: ROW_LIMIT,
        select: CARD_SELECT,
      })
    }
  }

  const categories = await Promise.all(
    CATEGORIES.map(async (c) => ({
      id: c.id,
      label: c.label,
      displays: await db.display.findMany({ where: { ...baseWhere, category: c.id }, orderBy: { views: 'desc' }, take: ROW_LIMIT, select: CARD_SELECT }),
    })),
  )

  // Order category rows by how trending they are (most total views first).
  const ranked = categories
    .filter((c) => c.displays.length > 0)
    .sort((a, b) => sumViews(b.displays) - sumViews(a.displays))

  return { trending, following, categories: ranked }
}
