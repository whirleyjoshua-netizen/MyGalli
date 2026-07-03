import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verify } from 'jsonwebtoken'
import { db } from '@/lib/db'
import { getJwtSecret } from '@/lib/auth'
import { AUTH_COOKIE } from '@/lib/constants'
import { ensureProfileCanvas } from '@/lib/profile-canvas'
import { ProfileEditor } from '@/components/profile/ProfileEditor'
import type { User } from '@/lib/types'
import type { Section } from '@/lib/types/canvas'
import type { BackgroundConfig } from '@/lib/types/background'
import type { SpacingConfig } from '@/lib/types/spacing'

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
      location: true, interests: true, links: true, featuredDisplayId: true, profileDisplayId: true,
    },
  })
  if (!user) redirect('/login')

  const displayId = await ensureProfileCanvas(user.id)
  const canvas = await db.display.findUnique({
    where: { id: displayId },
    select: { sections: true, background: true, spacing: true, version: true },
  })

  const initialSections = (canvas ? (typeof canvas.sections === 'string' ? JSON.parse(canvas.sections) : canvas.sections) : []) as Section[]
  const initialBackground = (canvas ? (typeof canvas.background === 'string' ? JSON.parse(canvas.background) : canvas.background) : null) as BackgroundConfig | null
  const initialSpacing = (canvas ? (typeof canvas.spacing === 'string' ? JSON.parse(canvas.spacing) : canvas.spacing) : null) as SpacingConfig | null

  const ownerUser: User = {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name ?? undefined,
    avatar: user.avatar ?? undefined,
    bio: user.bio ?? undefined,
    location: user.location,
    interests: user.interests,
    links: (user.links as { label: string; url: string }[] | null) || [],
    featuredDisplayId: user.featuredDisplayId,
  }

  return (
    <ProfileEditor
      username={user.username}
      user={ownerUser}
      displayId={displayId}
      initialSections={initialSections}
      initialBackground={initialBackground}
      initialSpacing={initialSpacing}
      initialVersion={canvas?.version ?? 0}
    />
  )
}
