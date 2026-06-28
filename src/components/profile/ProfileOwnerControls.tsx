'use client'

import { useState } from 'react'
import { ProfileIdCard } from '@/components/profile/ProfileIdCard'
import { EditProfileModal } from '@/components/profile/EditProfileModal'
import type { User } from '@/lib/types'

export function ProfileOwnerControls({
  user,
  followerCount,
  followingCount,
}: {
  user: User
  followerCount: number
  followingCount: number
}) {
  const [editing, setEditing] = useState(false)

  return (
    <>
      <ProfileIdCard
        user={{
          username: user.username,
          name: user.name ?? null,
          avatar: user.avatar ?? null,
          location: user.location ?? null,
        }}
        followerCount={followerCount}
        followingCount={followingCount}
        isOwner
        isFollowing={false}
        isFriend={false}
        onEdit={() => setEditing(true)}
      />
      <EditProfileModal isOpen={editing} onClose={() => setEditing(false)} user={user} />
    </>
  )
}
