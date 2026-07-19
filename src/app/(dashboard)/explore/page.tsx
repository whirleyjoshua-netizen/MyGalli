import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { getExploreTrending, getExploreCreators, getCategoryCounts, getPublicCommunities } from '@/lib/explore'
import { verifyAuth } from '@/lib/auth'
import { AUTH_COOKIE } from '@/lib/constants'
import { ExploreClient } from '@/components/explore/ExploreClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Explore — My Galli',
  description: 'Discover published pages, boards, hubs, and creators on My Galli.',
}

async function ExploreContent() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value
  const user = token ? await verifyAuth(token) : null
  const [trending, creators, categoryCounts, communities] = await Promise.all([
    getExploreTrending(),
    getExploreCreators(user?.id),
    getCategoryCounts(),
    getPublicCommunities(),
  ])
  return (
    <ExploreClient
      trending={trending}
      creators={creators}
      categoryCounts={categoryCounts}
      communities={communities}
    />
  )
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="px-4 py-7 sm:px-8"><p className="text-sm text-muted-foreground">Loading…</p></div>}>
      <ExploreContent />
    </Suspense>
  )
}
