'use client'

import Link from 'next/link'
import { FollowButton } from '@/components/social/FollowButton'
import type { ExploreCreator } from '@/lib/explore'

export function CreatorCard({ creator }: { creator: ExploreCreator }) {
  return (
    <div className="w-52 shrink-0 rounded-2xl border border-border bg-surface p-4 text-center shadow-soft">
      <Link href={`/${creator.username}`} className="block">
        <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-galli/30 to-galli-violet/30">
          {creator.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={creator.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-galli-dark">
              {(creator.name || creator.username).charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <p className="truncate font-bold">{creator.name || creator.username}</p>
        <p className="truncate text-sm text-muted-foreground">@{creator.username}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {creator.followerCount} follower{creator.followerCount === 1 ? '' : 's'}
        </p>
      </Link>
      <div className="mt-3 flex justify-center">
        <FollowButton username={creator.username} initialIsFollowing={creator.isFollowing} size="sm" />
      </div>
    </div>
  )
}
