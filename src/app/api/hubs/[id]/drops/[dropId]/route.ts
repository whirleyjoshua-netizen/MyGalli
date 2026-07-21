import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate } from '@/lib/community'
import { blobReadWriteToken } from '@/lib/storage-env'
import { isOwnDropAsset, canReviewDrop } from '@/lib/hub-drops'
import { createNotification, notifyHubMembers } from '@/lib/notifications'
import { rateLimit } from '@/lib/rate-limit'

type LoadedHub = { id: string; userId: string; community: boolean; title: string; slug: string; user: { username: string } }
type LoadedDrop = { id: string; authorId: string; url: string; thumbnailUrl: string | null; status: string }
type LoadResult =
  | { error: NextResponse; hub?: undefined; drop?: undefined; collabIds?: undefined }
  | { error?: undefined; hub: LoadedHub; drop: LoadedDrop; collabIds: string[] }

async function load(hubId: string, dropId: string): Promise<LoadResult> {
  const hub = await db.hub.findUnique({
    where: { id: hubId },
    select: { id: true, userId: true, community: true, title: true, slug: true, user: { select: { username: true } } },
  })
  if (!hub || !hub.community) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const drop = await db.hubDrop.findFirst({ where: { id: dropId, hubId }, select: { id: true, authorId: true, url: true, thumbnailUrl: true, status: true } })
  if (!drop) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const collabIds = (await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })).map((r) => r.userId)
  return { hub, drop, collabIds }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; dropId: string }> }): Promise<NextResponse> {
  const { id, dropId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await load(id, dropId)
  if (r.error) return r.error
  const isAuthor = r.drop.authorId === me.id
  if (!isAuthor && !canModerate(me.id, r.hub, r.collabIds)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await db.hubDrop.delete({ where: { id: dropId } })
  const token = blobReadWriteToken()
  // `del` runs with the app-wide RW token over a Blob store shared with avatars,
  // page images and message media. Never hand it a URL that isn't provably this
  // hub's own drop asset, whatever ended up persisted on the row.
  const owned = [r.drop.url, r.drop.thumbnailUrl].filter((u): u is string => !!u && isOwnDropAsset(id, u))
  if (token && owned.length) {
    const { del } = await import('@vercel/blob')
    await del(owned, { token }).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; dropId: string }> }): Promise<NextResponse> {
  const { id, dropId } = await params
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'hub-drop-review' })
  if (limited) return limited
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await load(id, dropId)
  if (r.error) return r.error
  const isPrivileged = canModerate(me.id, r.hub, r.collabIds)
  if (!canReviewDrop({ isPrivileged })) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const action = body?.action
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  // A drop can be reviewed exactly once. Without this a rejected drop (its
  // file already purged) can be re-approved and enter the public pool with a
  // dead URL, and an already-approved drop can be re-approved to replay the
  // author + hub-wide notifications with no rate limit backstop on either.
  if (r.drop.status !== 'pending') {
    return NextResponse.json({ error: 'This drop has already been reviewed' }, { status: 409 })
  }

  const status = action === 'approve' ? 'approved' : 'rejected'

  if (action === 'approve') {
    await db.hubDrop.update({
      where: { id: dropId },
      data: { status, hidden: false, reviewedAt: new Date(), reviewedById: me.id },
    })
  } else {
    // Write the row first, then purge, then persist the purge outcome — if the
    // purge resolves but a later write fails, the row must not still claim
    // `pending`/`assetDeleted:false` over a file that is already gone.
    await db.hubDrop.update({
      where: { id: dropId },
      data: { status, hidden: true, reviewedAt: new Date(), reviewedById: me.id },
    })

    // Reject destroys the file. `del` runs with the app-wide RW token over a store
    // shared with avatars, page images and message media — hand it only URLs that
    // are provably this hub's own drop assets, whatever ended up on the row.
    let assetDeleted = false
    const token = blobReadWriteToken()
    const owned = [r.drop.url, r.drop.thumbnailUrl].filter((u): u is string => !!u && isOwnDropAsset(id, u))
    if (token && owned.length) {
      const { del } = await import('@vercel/blob')
      // A stale file is a billing problem, not a safety one — never fail the
      // rejection because storage was unreachable.
      assetDeleted = await del(owned, { token }).then(() => true).catch(() => false)
    }
    if (assetDeleted) {
      await db.hubDrop.update({ where: { id: dropId }, data: { assetDeleted: true } })
    } else {
      console.warn(`hub-drop reject: purge skipped or failed for hub ${id} drop ${dropId}`)
    }
  }

  const actor = { id: me.id, name: me.name || me.username, avatar: me.avatar }
  const entityUrl = `/${r.hub.user.username}/hub/${r.hub.slug}`
  await createNotification({
    userId: r.drop.authorId,
    type: action === 'approve' ? 'hub_drop_approved' : 'hub_drop_rejected',
    actor,
    entityUrl,
    contextText: r.hub.title,
  })

  // The hub-wide "new clips" ping fires here, not on upload — members are never
  // told about content that was still invisible to them. This is deliberately
  // NOT routed through postNotifyTargets: that helper only broadcasts to the
  // full membership when the *author* is privileged, but here the author is a
  // plain member being approved by a moderator, so it would notify no one.
  // Build the recipient list explicitly: members + owner + collaborators,
  // deduped, minus the author (who already got hub_drop_approved above).
  if (action === 'approve') {
    const memberIds = (await db.hubMember.findMany({ where: { hubId: id }, select: { userId: true } })).map((m) => m.userId)
    const targets = [...new Set([r.hub.userId, ...r.collabIds, ...memberIds])].filter((uid) => uid !== r.drop.authorId)
    await notifyHubMembers(targets, { type: 'hub_drop', actor, entityUrl, contextText: r.hub.title })
  }

  return NextResponse.json({ ok: true, status })
}
