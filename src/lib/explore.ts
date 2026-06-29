import { db } from './db'
import { CATEGORIES } from './categories'

export interface ExploreRowItem {
  id: string
  slug: string
  title: string
  coverImage: string | null
  views: number
  category: string | null
  user: { username: string; name: string | null; avatar: string | null }
}

const CARD_SELECT = {
  id: true, slug: true, title: true, coverImage: true, views: true, category: true,
  user: { select: { username: true, name: true, avatar: true } },
} as const

const ROW_LIMIT = 12

export async function getExploreRows(): Promise<{
  trending: ExploreRowItem[]
  categories: { id: string; label: string; displays: ExploreRowItem[] }[]
}> {
  const baseWhere = { published: true, kind: { not: 'profile' } }
  const trending = await db.display.findMany({ where: baseWhere, orderBy: { views: 'desc' }, take: ROW_LIMIT, select: CARD_SELECT })
  const categories = await Promise.all(
    CATEGORIES.map(async (c) => ({
      id: c.id,
      label: c.label,
      displays: await db.display.findMany({ where: { ...baseWhere, category: c.id }, orderBy: { createdAt: 'desc' }, take: ROW_LIMIT, select: CARD_SELECT }),
    })),
  )
  return { trending, categories: categories.filter((c) => c.displays.length > 0) }
}
