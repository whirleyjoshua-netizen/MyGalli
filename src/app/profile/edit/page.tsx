import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verify } from 'jsonwebtoken'
import { db } from '@/lib/db'
import { getJwtSecret } from '@/lib/auth'
import { AUTH_COOKIE } from '@/lib/constants'
import { ProfileEditor } from '@/components/profile/ProfileEditor'
import type { User } from '@/lib/types'

export default async function ProfileEditPage() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value
  let meId: string | null = null
  if (token) {
    try { meId = (verify(token, getJwtSecret()) as { userId: string }).userId } catch { meId = null }
  }
  if (!meId) redirect('/login')

  const user = await db.user.findUnique({
    where: { id: meId },
    select: {
      id: true, email: true, username: true, name: true, avatar: true, bio: true,
      coverImage: true, location: true, interests: true, links: true, featuredDisplayId: true,
    },
  })
  if (!user) redirect('/login')

  const ownerUser: User = {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name ?? undefined,
    avatar: user.avatar ?? undefined,
    bio: user.bio ?? undefined,
    coverImage: user.coverImage ?? undefined,
    location: user.location,
    interests: user.interests,
    links: (user.links as { label: string; url: string }[] | null) || [],
    featuredDisplayId: user.featuredDisplayId,
  }

  return <ProfileEditor username={user.username} user={ownerUser} />
}
