import { db } from '@/lib/db'

// Returns the user's profile-canvas Display id, creating it if missing.
// Mirrors the create-or-get logic previously inline in POST /api/profile/canvas.
export async function ensureProfileCanvas(userId: string): Promise<string> {
  const fresh = await db.user.findUnique({
    where: { id: userId },
    select: { profileDisplayId: true, username: true },
  })

  if (fresh?.profileDisplayId) {
    const existing = await db.display.findUnique({
      where: { id: fresh.profileDisplayId },
      select: { id: true },
    })
    if (existing) return existing.id
  }

  const display = await db.display.create({
    data: {
      userId,
      kind: 'profile',
      published: true,
      slug: '__profile',
      title: `${fresh?.username ?? 'My'} profile`,
      sections: [],
    },
    select: { id: true },
  })
  await db.user.update({ where: { id: userId }, data: { profileDisplayId: display.id } })
  return display.id
}
