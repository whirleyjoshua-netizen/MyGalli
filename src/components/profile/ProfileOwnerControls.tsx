'use client'

import { useRouter } from 'next/navigation'
import { ProfileIdCard } from '@/components/profile/ProfileIdCard'
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
  const router = useRouter()
  return (
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
      onEdit={() => router.push('/profile/edit')}
    />
  )
}
