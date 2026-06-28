'use client'

import { useState } from 'react'
import { FollowListModal } from '@/components/social/FollowListModal'

export function ProfileFollowCounts({
  username,
  followerCount,
  followingCount,
}: {
  username: string
  followerCount: number
  followingCount: number
}) {
  const [open, setOpen] = useState<'followers' | 'following' | null>(null)

  return (
    <>
      <div className="mt-3 flex items-center gap-5 text-sm">
        <button onClick={() => setOpen('followers')} className="hover:underline cursor-pointer">
          <b className="text-foreground">{followerCount}</b> <span className="text-muted-foreground">followers</span>
        </button>
        <button onClick={() => setOpen('following')} className="hover:underline cursor-pointer">
          <b className="text-foreground">{followingCount}</b> <span className="text-muted-foreground">following</span>
        </button>
      </div>
      <FollowListModal isOpen={open === 'followers'} onClose={() => setOpen(null)} username={username} mode="followers" />
      <FollowListModal isOpen={open === 'following'} onClose={() => setOpen(null)} username={username} mode="following" />
    </>
  )
}
