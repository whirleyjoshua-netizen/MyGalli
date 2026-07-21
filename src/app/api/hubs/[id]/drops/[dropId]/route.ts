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
  // The Pending queue pages at 24 items; a moderator clearing a full page in
  // one sitting issues 24 PATCHes in well under a minute. 60/60s clears two
  // full pages (and two moderators behind one NAT) while still bounding abuse
  // on an endpoint that is moderator-only and does a Blob delete.
  const limited = await rateLimit(request, { limit: 60, windowMs: 60_000, prefix: 'hub-drop-review' })
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

  // Cheap early rejection off the read we already did. It saves a write on the
  // common case, but it is NOT what actually guards the race below — two
  // moderators clicking at the same instant can both pass this check.
  if (r.drop.status !== 'pending') {
    return NextResponse.json({ error: 'This drop has already been reviewed' }, { status: 409 })
  }

  const status = action === 'approve' ? 'approved' : 'rejected'

  // A drop can be reviewed exactly once. The transition itself must be atomic:
  // only a write that finds the row still `pending` may flip it, so of two
  // racing requests exactly one wins. Losing must be cheap and side-effect
  // free — in particular the reject path below must never purge a file for a
  // transition that lost this race.
  const transitioned = await db.hubDrop.updateMany({
    where: { id: dropId, status: 'pending' },
    data: { status, hidden: action === 'approve' ? false : true, reviewedAt: new Date(), reviewedById: me.id },
  })
  if (transitioned.count === 0) {
    return NextResponse.json({ error: 'This drop has already been reviewed' }, { status: 409 })
  }

  if (action === 'reject') {
    // The row is already committed to `rejected` above (we genuinely won the
    // transition) — now purge, then persist the purge outcome. If this
    // follow-up write throws, swallow it: `assetDeleted` is bookkeeping only,
    // and failing the request here would 500 after the file is already gone,
    // skip the author's notification, and leave the client re-showing an item
    // that 409s on every retry.
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
      await db.hubDrop.update({ where: { id: dropId }, data: { assetDeleted: true } }).catch(() => {})
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
    // Exclude both the author (already notified above) and the acting
    // moderator (who does not need a "new clips" ping for the clip they just
    // approved themselves).
    const targets = [...new Set([r.hub.userId, ...r.collabIds, ...memberIds])].filter(
      (uid) => uid !== r.drop.authorId && uid !== me.id,
    )
    await notifyHubMembers(targets, { type: 'hub_drop', actor, entityUrl, contextText: r.hub.title })
  }

  return NextResponse.json({ ok: true, status })
}
