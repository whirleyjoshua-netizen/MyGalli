import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { verify } from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/auth'
import { deriveFriend } from '@/lib/social'
import { AUTH_COOKIE } from '@/lib/constants'
import { ProfileCover } from '@/components/profile/ProfileCover'
import { GalliTopBar } from '@/components/nav/GalliTopBar'
import { ProfileSearchInput } from '@/components/nav/ProfileSearchInput'
import { ProfileHeaderCard } from '@/components/profile/ProfileHeaderCard'
import { ProfileBioBar } from '@/components/profile/ProfileBioBar'
import { ProfileProjectsSection } from '@/components/profile/ProfileProjectsSection'

async function getMeId(): Promise<string | null> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value
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
      id: true, username: true, name: true, avatar: true, bio: true,
      coverImage: true, featuredDisplayId: true,
    },
  })
  if (!user) notFound()

  const meId = await getMeId()
  const [followerCount, followingCount, displays, iFollow, followsMe] = await Promise.all([
    db.follow.count({ where: { followingId: user.id } }),
    db.follow.count({ where: { followerId: user.id } }),
    db.display.findMany({
      where: { userId: user.id, published: true, kind: { in: ['page', 'collection'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, slug: true, title: true, coverImage: true, views: true, kind: true },
    }),
    meId ? db.follow.findUnique({ where: { followerId_followingId: { followerId: meId, followingId: user.id } }, select: { id: true } }) : null,
    meId ? db.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: meId } }, select: { id: true } }) : null,
  ])
  const isFollowing = !!iFollow
  const isFriend = deriveFriend(isFollowing, !!followsMe)
  const isMe = meId === user.id

  return (
    <div className="min-h-screen bg-background">
      <GalliTopBar search={<ProfileSearchInput />} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-10">
        <ProfileCover coverImage={user.coverImage} isOwner={isMe} />
        <div className="space-y-5">
          <ProfileHeaderCard
            username={user.username}
            name={user.name}
            avatar={user.avatar}
            followerCount={followerCount}
            followingCount={followingCount}
            isOwner={isMe}
            isFollowing={isFollowing}
            isFriend={isFriend}
          />
          <ProfileBioBar bio={user.bio} />
          <ProfileProjectsSection
            username={user.username}
            name={user.name}
            displays={displays}
            featuredId={user.featuredDisplayId}
            isOwner={isMe}
          />
        </div>
      </div>
    </div>
  )
}
