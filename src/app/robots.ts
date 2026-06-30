import type { MetadataRoute } from 'next'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://galli.page'

// Allow crawling of public marketing + creator pages; keep app/private surfaces out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/dashboard',
        '/editor',
        '/analytics',
        '/responses',
        '/library',
        '/apps',
        '/shared',
        '/new-kit',
        '/card-studio',
        '/create',
        '/login',
        '/signup',
        '/verify',
        '/forgot',
        '/reset',
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}
