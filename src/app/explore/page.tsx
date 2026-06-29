import { Suspense } from 'react'
import { getExploreRows } from '@/lib/explore'
import { ExploreClient } from '@/components/explore/ExploreClient'
import type { Metadata } from 'next'
import { ExploreCardSkeleton } from '@/components/explore/ExploreCardSkeleton'

export const metadata: Metadata = {
  title: 'Explore — Galli',
  description: 'Discover published pages from athletes, creators, and professionals on Galli.',
}

const PAGE_SIZE = 12

async function ExploreContent() {
  const initialRows = await getExploreRows()
  return <ExploreClient initialRows={initialRows} />
}

function ExploreLoadingShell() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-14 border-b border-border/50 bg-gradient-to-r from-galli/10 via-galli-aqua/5 to-galli-violet/10" />
      <div className="bg-gradient-to-br from-galli/10 via-galli-aqua/5 to-galli-violet/10 border-b border-border/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="h-10 bg-muted/50 rounded w-64 mb-3 animate-pulse" />
          <div className="h-6 bg-muted/50 rounded w-96 animate-pulse" />
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <ExploreCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<ExploreLoadingShell />}>
      <ExploreContent />
    </Suspense>
  )
}
