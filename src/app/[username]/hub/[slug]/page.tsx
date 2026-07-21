import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { HubViewer } from '@/components/hub/HubViewer'
import { resolveHubVisibility, readUnlockToken } from '@/lib/hub-access'
import { getUserFromCookies } from '@/lib/get-user-from-cookies'
import { visibleNotes, toStripNote } from '@/lib/hub-notes'
import { visibleBookmarks } from '@/lib/hub-highlight'
import { CommunityHubView } from '@/components/hub/community/CommunityHubView'
import { GalliTopBar } from '@/components/nav/GalliTopBar'
import { canViewCommunityHub } from '@/lib/community'
import { sanitizeHubConfig } from '@/lib/hub-config'
import { toEventDTO } from '@/lib/hub-events'
import { toDropDTO } from '@/lib/hub-drops'

interface Props {
  params: Promise<{ username: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params

  const user = await db.user.findUnique({ where: { username }, select: { id: true } })
  if (!user) return {}

  const hub = await db.hub.findUnique({ where: { userId_slug: { userId: user.id, slug } } })
  if (!hub) return {}

  if (hub.community) {
    if (!hub.published) return {}
    return {
      title: hub.title,
      description: hub.tagline || hub.description || undefined,
    }
  }

  if (!hub.displayId) return {}

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
  if (!hub) notFound()

  const viewerUser = await getUserFromCookies()
  let viewer: 'owner' | 'collaborator' | 'public' = 'public'
  if (viewerUser?.id === hub.userId) viewer = 'owner'
  else if (viewerUser) {
    const collab = await db.hubCollaborator.findUnique({ where: { hubId_userId: { hubId: hub.id, userId: viewerUser.id } }, select: { id: true } })
    if (collab) viewer = 'collaborator'
  }
  const isPrivileged = viewer === 'owner' || viewer === 'collaborator'

  // Community hubs render the community page and gate on their own published flag.
  if (hub.community) {
    if (!canViewCommunityHub({ published: hub.published, isPrivileged })) notFound()
    // 7-day rolling window. "Since your last visit" would need a lastSeenAt on
    // HubMember (a migration) for marginal extra value — see the design spec.
    const activitySince = new Date(Date.now() - 7 * 864e5)
    const [memberRows, items, postsCount, mine, eventRows, eventsCount, dropRows, dropsCount, noteRows, newPostsCount, newDropsCount, newMembersCount, pendingDropsCount] = await Promise.all([
      db.hubMember.findMany({ where: { hubId: hub.id }, select: { userId: true, user: { select: { username: true, name: true, avatar: true } } } }),
      db.hubItem.findMany({ where: { hubId: hub.id, visibility: 'public', type: { in: ['file', 'link'] } }, orderBy: { createdAt: 'desc' } }),
      db.hubPost.count({ where: { hubId: hub.id } }),
      viewerUser ? db.hubMember.findUnique({ where: { hubId_userId: { hubId: hub.id, userId: viewerUser.id } }, select: { id: true } }) : Promise.resolve(null),
      db.hubEvent.findMany({ where: { hubId: hub.id, startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' }, take: 6 }),
      db.hubEvent.count({ where: { hubId: hub.id, startsAt: { gte: new Date() } } }),
      db.hubDrop.findMany({
        // The tile and viewer are the approved pool for everyone, owner included —
        // pending items are fetched separately by the viewer's Pending tab.
        where: { hubId: hub.id, status: 'approved' },
        orderBy: { createdAt: 'desc' }, take: 24,
        include: { author: { select: { id: true, username: true, name: true, avatar: true } } },
      }),
      db.hubDrop.count({ where: { hubId: hub.id, status: 'approved' } }),
      db.hubNote.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } }),
      db.hubPost.count({ where: { hubId: hub.id, createdAt: { gte: activitySince } } }),
      db.hubDrop.count({ where: { hubId: hub.id, status: 'approved', createdAt: { gte: activitySince } } }),
      db.hubMember.count({ where: { hubId: hub.id, createdAt: { gte: activitySince } } }),
      isPrivileged ? db.hubDrop.count({ where: { hubId: hub.id, status: 'pending' } }) : Promise.resolve(0),
    ])
    const members = memberRows.map((m) => ({ userId: m.userId, username: m.user.username, name: m.user.name, avatar: m.user.avatar }))
    const resources = items.map((i) => ({ id: i.id, type: i.type, title: i.title, url: i.url }))
    const events = eventRows.map(toEventDTO)
    const drops = dropRows.map(toDropDTO)
    // visibleNotes runs server-side: a visitor's HTML never contains a private note.
    const notes = visibleNotes(noteRows, viewer === 'owner').map(toStripNote)
    const config = sanitizeHubConfig(hub.config)
    return (
      <>
        {/* Community hubs are standalone pages, so they carry no app chrome of
            their own — without this a visitor has no way back to Galli and no
            profile access. Same bar the public profile page uses. */}
        <GalliTopBar tone="light" />
        <CommunityHubView
        hub={{ id: hub.id, title: hub.title, tagline: hub.tagline, description: hub.description, coverImage: hub.coverImage, heroVideoUrl: hub.heroVideoUrl }}
        ownerUsername={user.username}
        currentUserId={viewerUser?.id}
        isPrivileged={isPrivileged}
        isOwner={viewer === 'owner'}
        joined={!!mine}
        memberCount={members.length}
        members={members}
        resources={resources}
        events={events}
        drops={drops}
        pendingCount={pendingDropsCount}
        notes={notes}
        counts={{ posts: postsCount, members: members.length, resources: resources.length, events: eventsCount, kollab: dropsCount }}
        activity={{ newPosts: newPostsCount, newDrops: newDropsCount, newMembers: newMembersCount }}
        sharePath={`/${user.username}/hub/${slug}`}
        config={config}
        />
      </>
    )
  }

  // Non-community hubs keep the data-room viewer (requires a published Display).
  if (!hub.displayId) notFound()
  const display = await db.display.findUnique({ where: { id: hub.displayId }, select: { published: true } })
  if (!display || !display.published) notFound()

  const [folders, items, notes, bookmarks] = await Promise.all([
    db.hubFolder.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } }),
    db.hubItem.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } }),
    db.hubNote.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } }),
    db.hubNoteBookmark.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } }),
  ])

  const cookieStore = await cookies()
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
    color: n.color,
  }))

  const noteVisibility = Object.fromEntries(notes.map((n) => [n.id, n.visibility]))
  const safeBookmarks = visibleBookmarks(bookmarks, noteVisibility, viewer === 'owner').map((b) => ({
    id: b.id, noteId: b.noteId, itemId: b.itemId, page: b.page,
    rects: b.rects as unknown as { x: number; y: number; w: number; h: number }[],
    title: b.title,
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
      bookmarks={safeBookmarks}
      username={user.username}
      hubId={hub.id}
      currentUserId={viewerUser?.id}
    />
  )
}
