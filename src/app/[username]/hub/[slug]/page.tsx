import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { HubViewer } from '@/components/hub/HubViewer'

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

  const [folders, items] = await Promise.all([
    db.hubFolder.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } }),
    db.hubItem.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } }),
  ])

  return (
    <HubViewer
      hub={{
        id: hub.id,
        title: hub.title,
        description: hub.description,
        coverImage: hub.coverImage,
      }}
      folders={folders.map((f) => ({ id: f.id, parentId: f.parentId, name: f.name, order: f.order }))}
      items={items.map((i) => ({
        id: i.id,
        hubId: i.hubId,
        folderId: i.folderId,
        type: i.type,
        title: i.title,
        url: i.url,
        content: i.content,
        order: i.order,
      }))}
      username={user.username}
    />
  )
}
