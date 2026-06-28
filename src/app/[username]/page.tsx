import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { verify } from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/auth'
import { deriveFriend } from '@/lib/social'
import { AUTH_COOKIE } from '@/lib/constants'
import type { User } from '@/lib/types'
import { ProfileIdCard } from '@/components/profile/ProfileIdCard'
import { ProfileOwnerControls } from '@/components/profile/ProfileOwnerControls'
import { ProfilePagesScroll } from '@/components/profile/ProfilePagesScroll'
import { ProfileAbout } from '@/components/profile/ProfileAbout'

async function getMeId(): Promise<string | null> {
  const token = cookies().get(AUTH_COOKIE)?.value
  if (!token) return null
  try {
    return (verify(token, getJwtSecret()) as { userId: string }).userId
  } catch {
    return null
  }
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true, email: true, username: true, name: true, avatar: true, bio: true,
      location: true, interests: true, links: true, featuredDisplayId: true,
    },
  })
  if (!user) notFound()

  const meId = await getMeId()
  const [followerCount, followingCount, displays, iFollow, followsMe] = await Promise.all([
    db.follow.count({ where: { followingId: user.id } }),
    db.follow.count({ where: { followerId: user.id } }),
    db.display.findMany({
      where: { userId: user.id, published: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, slug: true, title: true, coverImage: true, views: true },
    }),
    meId ? db.follow.findUnique({ where: { followerId_followingId: { followerId: meId, followingId: user.id } }, select: { id: true } }) : null,
    meId ? db.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: meId } }, select: { id: true } }) : null,
  ])
  const isFollowing = !!iFollow
  const isFriend = deriveFriend(isFollowing, !!followsMe)
  const isMe = meId === user.id
  const links = (user.links as { label: string; url: string }[] | null) || []

  const ownerUser: User = {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name ?? undefined,
    avatar: user.avatar ?? undefined,
    bio: user.bio ?? undefined,
    location: user.location,
    interests: user.interests,
    links,
    featuredDisplayId: user.featuredDisplayId,
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Row 1: ID card + pages scroll */}
        <div className="flex flex-col lg:flex-row gap-6">
          {isMe ? (
            <ProfileOwnerControls user={ownerUser} followerCount={followerCount} followingCount={followingCount} />
          ) : (
            <ProfileIdCard
              user={{ username: user.username, name: user.name, avatar: user.avatar, location: user.location }}
              followerCount={followerCount}
              followingCount={followingCount}
              isOwner={false}
              isFollowing={isFollowing}
              isFriend={isFriend}
            />
          )}
          <ProfilePagesScroll username={user.username} pages={displays} featuredId={user.featuredDisplayId} isOwner={isMe} />
        </div>

        {/* Row 2: About */}
        <ProfileAbout bio={user.bio} interests={user.interests} links={links} />

        {/* Row 3: Sub-project B editable canvas mounts here */}
      </div>
    </div>
  )
}
