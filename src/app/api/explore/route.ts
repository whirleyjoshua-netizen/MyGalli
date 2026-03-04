import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { rateLimit } from '@/lib/rate-limit'

const PAGE_SIZE = 12
const KNOWN_KITS = ['athlete', 'resume']

// kitConfig is stored as a JSON string (double-encoded), so JSON path
// filtering doesn't work. Use string_contains for kit matching instead.
function buildKitFilter(kit: string) {
  if (kit === 'athlete') {
    return { kitConfig: { string_contains: 'athlete' } }
  }
  if (kit === 'resume') {
    return { kitConfig: { string_contains: 'resume' } }
  }
  if (kit === 'custom') {
    // No kitConfig at all (null), or kitConfig without any known kit ID
    return {
      OR: [
        { kitConfig: { equals: Prisma.DbNull } },
        {
          AND: [
            { NOT: { kitConfig: { string_contains: 'athlete' } } },
            { NOT: { kitConfig: { string_contains: 'resume' } } },
          ],
        },
      ],
    }
  }
  return {} // 'all'
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { limit: 120, windowMs: 60_000, prefix: 'explore' })
  if (limited) return limited

  try {
    const { searchParams } = request.nextUrl
    const kit = searchParams.get('kit') || 'all'
    const search = searchParams.get('search') || ''
    const sort = searchParams.get('sort') || 'recent'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') || String(PAGE_SIZE), 10)))

    const kitFilter = buildKitFilter(kit)

    // Search filter
    const searchFilter = search
      ? {
          OR: [
            { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { user: { username: { contains: search, mode: Prisma.QueryMode.insensitive } } },
            { user: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
          ],
        }
      : {}

    const where = { published: true, ...kitFilter, ...searchFilter }

    const orderBy =
      sort === 'popular'
        ? { views: 'desc' as const }
        : sort === 'updated'
          ? { updatedAt: 'desc' as const }
          : { createdAt: 'desc' as const }

    const [total, displays] = await Promise.all([
      db.display.count({ where }),
      db.display.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          views: true,
          createdAt: true,
          updatedAt: true,
          kitConfig: true,
          headerCard: true,
          background: true,
          user: {
            select: { username: true, name: true, avatar: true },
          },
        },
      }),
    ])

    return NextResponse.json({
      displays,
      total,
      page,
      pageSize: limit,
      hasMore: page * limit < total,
    })
  } catch (error) {
    console.error('Explore API error:', error)
    return NextResponse.json({ error: 'Failed to fetch displays' }, { status: 500 })
  }
}
