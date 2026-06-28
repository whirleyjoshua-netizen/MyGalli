import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { verify } from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/auth'
import { deriveFriend } from '@/lib/social'
import { FollowButton } from '@/components/social/FollowButton'
import { AUTH_COOKIE } from '@/lib/constants'

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
    select: { id: true, username: true, name: true, avatar: true, bio: true },
  })
  if (!user) notFound()

  const meId = await getMeId()
  const [followerCount, followingCount, displays, iFollow, followsMe] = await Promise.all([
    db.follow.count({ where: { followingId: user.id } }),
    db.follow.count({ where: { followerId: user.id } }),
    db.display.findMany({ where: { userId: user.id, published: true }, orderBy: { createdAt: 'desc' }, select: { id: true, slug: true, title: true, coverImage: true, views: true } }),
    meId ? db.follow.findUnique({ where: { followerId_followingId: { followerId: meId, followingId: user.id } }, select: { id: true } }) : null,
    meId ? db.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: meId } }, select: { id: true } }) : null,
  ])
  const isFollowing = !!iFollow
  const isFriend = deriveFriend(isFollowing, !!followsMe)
  const isMe = meId === user.id
  const initial = (user.name || user.username).charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-start gap-5">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="w-20 h-20 rounded-2xl object-cover" />
          ) : (
            <span className="w-20 h-20 rounded-2xl bg-primary/15 text-primary font-bold text-2xl flex items-center justify-center">{initial}</span>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold">{user.name || user.username}</h1>
            <p className="text-muted-foreground">@{user.username}</p>
            {user.bio && <p className="mt-2 text-sm text-foreground/80">{user.bio}</p>}
            <div className="mt-3 flex items-center gap-5 text-sm">
              <span><b className="text-foreground">{followerCount}</b> <span className="text-muted-foreground">followers</span></span>
              <span><b className="text-foreground">{followingCount}</b> <span className="text-muted-foreground">following</span></span>
            </div>
          </div>
          {!isMe && meId && (
            <FollowButton username={user.username} initialIsFollowing={isFollowing} initialIsFriend={isFriend} />
          )}
        </div>

        <h2 className="mt-10 mb-4 text-lg font-bold">Pages</h2>
        {displays.length === 0 ? (
          <p className="text-muted-foreground text-sm">No published pages yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displays.map((d) => (
              <a key={d.id} href={`/${user.username}/${d.slug}`} className="group rounded-2xl border border-border bg-surface overflow-hidden shadow-soft hover:shadow-soft-lg transition-all">
                <div className={`h-32 ${d.coverImage ? '' : 'bg-gradient-to-br from-galli/20 to-galli-violet/20'}`}>
                  {d.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.coverImage} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{d.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.views} views</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
