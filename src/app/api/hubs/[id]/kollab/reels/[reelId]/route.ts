import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate } from '@/lib/community'

type LoadedHub = { id: string; userId: string; community: boolean }
type LoadedReel = { id: string; hubId: string; creatorId: string; status: string }
type LoadResult =
  | { error: NextResponse; hub?: undefined; reel?: undefined; collabIds?: undefined }
  | { error?: undefined; hub: LoadedHub; reel: LoadedReel; collabIds: string[] }

async function load(hubId: string, reelId: string): Promise<LoadResult> {
  const hub = await db.hub.findUnique({
    where: { id: hubId },
    select: { id: true, userId: true, community: true },
  })
  if (!hub || !hub.community) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }

  // Scoped by hubId so a reel id from another hub 404s rather than resolving.
  const reel = await db.kollabReel.findFirst({
    where: { id: reelId, hubId },
    select: { id: true, hubId: true, creatorId: true, status: true },
  })
  if (!reel) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }

  const collabIds = (await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })).map((r) => r.userId)
  return { hub, reel, collabIds }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reelId: string }> },
): Promise<NextResponse> {
  const { id, reelId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const r = await load(id, reelId)
  if (r.error) return r.error

  // Publishing is the moderation gate: it is what makes a member-generated
  // reel visible to the public. The reel's own creator must not be able to
  // publish it merely by having created it — only owners/collaborators can.
  if (!canModerate(me.id, r.hub, r.collabIds)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}) as Record<string, unknown>)
  const action = (body as any)?.action
  if (action !== 'publish' && action !== 'unpublish') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const status = action === 'publish' ? 'published' : 'draft'
  await db.kollabReel.update({ where: { id: reelId }, data: { status } })
  return NextResponse.json({ id: reelId, status })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reelId: string }> },
): Promise<NextResponse> {
  const { id, reelId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const r = await load(id, reelId)
  if (r.error) return r.error

  // Creator or moderator: people can remove their own work, moderators can
  // remove anyone's.
  const isCreator = r.reel.creatorId === me.id
  if (!isCreator && !canModerate(me.id, r.hub, r.collabIds)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // No Blob cleanup here: a reel owns no assets, only references to HubDrop
  // rows that continue to exist independently for the pool and other reels.
  await db.kollabReel.delete({ where: { id: reelId } })
  return NextResponse.json({ ok: true })
}
