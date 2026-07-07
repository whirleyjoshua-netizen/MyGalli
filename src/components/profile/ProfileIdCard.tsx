'use client'

import { useState } from 'react'
import { MapPin, Pencil, Mail } from 'lucide-react'
import { FollowButton } from '@/components/social/FollowButton'
import { ProfileFollowCounts } from '@/components/social/ProfileFollowCounts'
import { ShareProfileButton } from '@/components/profile/ShareProfileButton'
import { ProfileMailboxModal } from '@/components/profile/ProfileMailboxModal'

export interface ProfileIdCardUser {
  username: string
  name: string | null
  avatar: string | null
  location: string | null
}

export function ProfileIdCard({
  user,
  followerCount,
  followingCount,
  isOwner,
  isFollowing,
  isFriend,
  onEdit,
}: {
  user: ProfileIdCardUser
  followerCount: number
  followingCount: number
  isOwner: boolean
  isFollowing: boolean
  isFriend: boolean
  onEdit?: () => void
}) {
  const initial = (user.name || user.username).charAt(0).toUpperCase()
  const [mailboxOpen, setMailboxOpen] = useState(false)

  return (
    <div className="w-full lg:w-80 shrink-0 p-5 rounded-2xl border border-border bg-surface shadow-soft">
      <div className="flex items-center gap-4">
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar} alt="" className="w-16 h-16 rounded-2xl object-cover shrink-0" />
        ) : (
          <span className="w-16 h-16 rounded-2xl bg-gradient-to-br from-galli/30 to-galli-violet/30 text-galli-dark font-bold text-xl flex items-center justify-center shrink-0">
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold truncate">{user.name || user.username}</h1>
          <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
        </div>
      </div>

      {user.location && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 shrink-0" /> {user.location}
        </p>
      )}

      <ProfileFollowCounts username={user.username} followerCount={followerCount} followingCount={followingCount} />

      <div className="mt-4 flex items-center gap-2">
        {isOwner ? (
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shadow-soft hover:brightness-105 transition-all cursor-pointer"
          >
            <Pencil className="w-4 h-4" /> Edit profile
          </button>
        ) : (
          <FollowButton username={user.username} initialIsFollowing={isFollowing} initialIsFriend={isFriend} />
        )}
        <ShareProfileButton username={user.username} />
        <button
          onClick={() => setMailboxOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted transition-all cursor-pointer"
        >
          <Mail className="w-4 h-4" /> Message
        </button>
      </div>

      {mailboxOpen && (
        <ProfileMailboxModal username={user.username} name={user.name} onClose={() => setMailboxOpen(false)} />
      )}
    </div>
  )
}
