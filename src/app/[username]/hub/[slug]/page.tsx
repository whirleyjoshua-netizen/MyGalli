import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { HubViewer } from '@/components/hub/HubViewer'
import { resolveHubVisibility, readUnlockToken } from '@/lib/hub-access'
import { getUserFromCookies } from '@/lib/get-user-from-cookies'
import { visibleNotes } from '@/lib/hub-notes'

interface Props {
  params: Promise<{ username: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params

  const user = await db.user.findUnique({ where: { username }, select: { id: true } })
  if (!user) return {}

  const hub = await db.hub.findUnique({ where: { userId_slug: { userId: user.id, slug } } })
  if (!hub || !hub.displayId) return {}

  const display = await db.display.findUnique({ where: { id: hub.displayId }, select: { published: true } })
  if (!display || !display.published) return {}

  return {
    title: hub.title,
    description: hub.description || undefined,
  }
}

export default async function PublicHubPage({ params }: Props) {
  const { username, slug } = await params

  const user = await db.user.findUnique({ where: { username }, select: { id: true, username: true } })
  if (!user) {
    notFound()
  }

  const hub = await db.hub.findUnique({ where: { userId_slug: { userId: user.id, slug } } })
  if (!hub || !hub.displayId) {
    notFound()
  }

  const display = await db.display.findUnique({ where: { id: hub.displayId }, select: { published: true } })
  if (!display || !display.published) {
    notFound()
  }

  const [folders, items, notes] = await Promise.all([
    db.hubFolder.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } }),
    db.hubItem.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } }),
    db.hubNote.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } }),
  ])

  const cookieStore = await cookies()
  const viewerUser = await getUserFromCookies()
  let viewer: 'owner' | 'collaborator' | 'public' = 'public'
  if (viewerUser?.id === hub.userId) {
    viewer = 'owner'
  } else if (viewerUser) {
    const collab = await db.hubCollaborator.findUnique({
      where: { hubId_userId: { hubId: hub.id, userId: viewerUser.id } },
      select: { id: true },
    })
    if (collab) viewer = 'collaborator'
  }

  const unlockedIds = new Set(readUnlockToken(cookieStore.get(`hub_unlock_${hub.id}`)?.value, hub.id))
  const status = resolveHubVisibility({
    folders: folders.map((f) => ({ id: f.id, parentId: f.parentId, visibility: f.visibility, hasPasscode: !!f.passcodeHash })),
    items: items.map((i) => ({ id: i.id, folderId: i.folderId, visibility: i.visibility, hasPasscode: !!i.passcodeHash })),
    viewer,
    unlockedIds,
  })

  const safeFolders = folders
    .filter((f) => status.get(f.id) !== 'hidden')
    .map((f) => ({
      id: f.id,
      parentId: f.parentId,
      name: f.name,
      order: f.order,
      locked: status.get(f.id) === 'locked',
    }))

  const safeItems = items
    .filter((i) => status.get(i.id) !== 'hidden')
    .map((i) => {
      const locked = status.get(i.id) === 'locked'
      return {
        id: i.id,
        hubId: i.hubId,
        folderId: i.folderId,
        type: i.type,
        title: i.title,
        url: locked ? null : i.url,
        content: locked ? null : i.content,
        order: i.order,
        locked,
      }
    })

  const safeNotes = visibleNotes(notes, viewer === 'owner').map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    linkedItemId: n.linkedItemId,
    minimized: n.minimized,
  }))

  return (
    <HubViewer
      hub={{
        id: hub.id,
        title: hub.title,
        description: hub.description,
        coverImage: hub.coverImage,
      }}
      folders={safeFolders}
      items={safeItems}
      notes={safeNotes}
      username={user.username}
      hubId={hub.id}
    />
  )
}
