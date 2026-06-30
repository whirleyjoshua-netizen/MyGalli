import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://galli.page'

// Render on-request (in the server process, where the DB is reachable) rather than
// in a static-generation worker; cheap enough for a crawler-frequency endpoint.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: APP_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${APP_URL}/explore`, changeFrequency: 'daily', priority: 0.8 },
  ]

  try {
    const displays = await db.display.findMany({
      where: { published: true, kind: { not: 'profile' } },
      select: { slug: true, updatedAt: true, user: { select: { username: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    })

    const pageRoutes: MetadataRoute.Sitemap = displays
      .filter((d) => d.user?.username)
      .map((d) => ({
        url: `${APP_URL}/${d.user.username}/${d.slug}`,
        lastModified: d.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.6,
      }))

    return [...staticRoutes, ...pageRoutes]
  } catch {
    // If the DB is unreachable at generation time, still serve the static routes.
    return staticRoutes
  }
}
