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

// --- Redesign queries (read-only, no schema change) ---

export interface TrendingItem extends ExploreRowItem {
  followerCount: number
}

// Top published pages/boards by all-time views, with the author's follower count.
export async function getExploreTrending(limit = 10): Promise<TrendingItem[]> {
  const items = await db.display.findMany({
    where: { published: true, kind: { not: 'profile' } },
    orderBy: { views: 'desc' },
    take: limit,
    select: {
      id: true, slug: true, title: true, coverImage: true, views: true, category: true, kind: true,
      user: { select: { username: true, name: true, avatar: true, _count: { select: { followers: true } } } },
    },
  })
  return items.map((d) => ({
    id: d.id, slug: d.slug, title: d.title, coverImage: d.coverImage, views: d.views,
    category: d.category, kind: d.kind,
    user: { username: d.user.username, name: d.user.name, avatar: d.user.avatar },
    followerCount: d.user._count.followers,
  }))
}

export interface ExploreCreator {
  id: string
  username: string
  name: string | null
  avatar: string | null
  followerCount: number
  isFollowing: boolean
}

// Creators to discover: users with at least one published page, ranked by followers.
export async function getExploreCreators(viewerId?: string, limit = 8): Promise<ExploreCreator[]> {
  const users = await db.user.findMany({
    where: {
      displays: { some: { published: true, kind: { not: 'profile' } } },
      ...(viewerId ? { id: { not: viewerId } } : {}),
    },
    select: { id: true, username: true, name: true, avatar: true, _count: { select: { followers: true } } },
    orderBy: { followers: { _count: 'desc' } },
    take: limit,
  })

  let followingSet = new Set<string>()
  if (viewerId && users.length > 0) {
    const rows = await db.follow.findMany({
      where: { followerId: viewerId, followingId: { in: users.map((u) => u.id) } },
      select: { followingId: true },
    })
    followingSet = new Set(rows.map((r) => r.followingId))
  }

  return users.map((u) => ({
    id: u.id, username: u.username, name: u.name, avatar: u.avatar,
    followerCount: u._count.followers, isFollowing: followingSet.has(u.id),
  }))
}

// Per-category counts of published pages/boards, for the Browse-by-Category tiles.
export async function getCategoryCounts(): Promise<Record<string, number>> {
  const groups = await db.display.groupBy({
    by: ['category'],
    where: { published: true, kind: { not: 'profile' } },
    _count: { _all: true },
  })
  const out: Record<string, number> = {}
  for (const g of groups) if (g.category) out[g.category] = g._count._all
  return out
}

export interface ExploreCommunity {
  id: string
  slug: string
  title: string
  coverImage: string | null
  memberCount: number
  user: { username: string; name: string | null; avatar: string | null }
}

// Published community hubs, ranked by members — for the Hubs chip view.
export async function getPublicCommunities(limit = 12): Promise<ExploreCommunity[]> {
  const hubs = await db.hub.findMany({
    where: { community: true, published: true },
    orderBy: { members: { _count: 'desc' } },
    take: limit,
    select: {
      id: true, slug: true, title: true, coverImage: true,
      user: { select: { username: true, name: true, avatar: true } },
      _count: { select: { members: true } },
    },
  })
  return hubs.map((h) => ({
    id: h.id, slug: h.slug, title: h.title, coverImage: h.coverImage,
    memberCount: h._count.members,
    user: { username: h.user.username, name: h.user.name, avatar: h.user.avatar },
  }))
}
