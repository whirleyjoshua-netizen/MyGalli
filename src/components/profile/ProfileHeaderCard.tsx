import { ProfileFollowCounts } from '@/components/social/ProfileFollowCounts'
import { ProfileActionCards } from '@/components/profile/ProfileActionCards'

export function ProfileHeaderCard({
  username,
  name,
  avatar,
  followerCount,
  followingCount,
  isOwner,
  isFollowing,
  isFriend,
}: {
  username: string
  name: string | null
  avatar: string | null
  followerCount: number
  followingCount: number
  isOwner: boolean
  isFollowing: boolean
  isFriend: boolean
}) {
  const initial = (name || username).charAt(0).toUpperCase()
  return (
    <div className="relative -mt-12 rounded-3xl border border-border bg-surface shadow-soft px-6 py-5 flex flex-col lg:flex-row lg:items-center gap-5">
      <div className="flex items-center gap-4 shrink-0">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="w-20 h-20 rounded-full object-cover ring-4 ring-surface shrink-0" />
        ) : (
          <span className="w-20 h-20 rounded-full ring-4 ring-surface bg-gradient-to-br from-galli/30 to-galli-violet/30 text-galli-dark font-bold text-2xl flex items-center justify-center shrink-0">
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold truncate">{name || username}</h1>
          <p className="text-sm text-muted-foreground truncate">@{username}</p>
          <ProfileFollowCounts username={username} followerCount={followerCount} followingCount={followingCount} />
        </div>
      </div>

      <div className="lg:ml-auto">
        <ProfileActionCards
          isOwner={isOwner}
          username={username}
          name={name}
          isFollowing={isFollowing}
          isFriend={isFriend}
        />
      </div>
    </div>
  )
}
