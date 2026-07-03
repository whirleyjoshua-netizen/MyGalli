'use client'

import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { FollowButton } from './FollowButton'

interface CreatorChipProps {
  username: string
  name: string | null
  avatar: string | null
  slug: string
  isAuthed: boolean
  viewerIsFollowing: boolean
  viewerIsFriend: boolean
}

// Persistent, account-tied attribution + follow affordance for published pages.
// Fixed bottom-left so it works uniformly over custom header cards, tabs, and
// plain pages. Owner never sees it (caller gates on !isOwner).
export function CreatorChip({
  username,
  name,
  avatar,
  slug,
  isAuthed,
  viewerIsFollowing,
  viewerIsFriend,
}: CreatorChipProps) {
  const displayName = name || username
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-border bg-surface/90 backdrop-blur-md shadow-soft-lg pl-1.5 pr-1.5 py-1.5 max-w-[calc(100vw-2rem)]">
      {/* Attribution — links to the creator's profile */}
      <Link
        href={`/${username}`}
        className="flex items-center gap-2 min-w-0 rounded-full pl-0.5 pr-1 hover:opacity-90 transition-opacity"
        aria-label={`View ${displayName}'s profile`}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {initial}
          </span>
        )}
        <span className="flex flex-col min-w-0 leading-tight">
          <span className="truncate text-sm font-semibold text-foreground">{displayName}</span>
          <span className="truncate text-xs text-muted-foreground">@{username}</span>
        </span>
      </Link>

      {/* Follow — real toggle when authed, otherwise a login redirect */}
      {isAuthed ? (
        <FollowButton
          username={username}
          initialIsFollowing={viewerIsFollowing}
          initialIsFriend={viewerIsFriend}
          size="sm"
        />
      ) : (
        <Link
          href={`/login?next=/${username}/${slug}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground shadow-soft hover:brightness-105 transition-all"
        >
          <UserPlus className="w-4 h-4" /> Follow
        </Link>
      )}
    </div>
  )
}
