import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate } from '@/lib/community'
import { blobReadWriteToken } from '@/lib/storage-env'

type LoadResult =
  | { error: NextResponse; hub?: undefined; drop?: undefined; collabIds?: undefined }
  | { error?: undefined; hub: { id: string; userId: string; community: boolean }; drop: { id: string; authorId: string; url: string; thumbnailUrl: string | null }; collabIds: string[] }

async function load(hubId: string, dropId: string): Promise<LoadResult> {
  const hub = await db.hub.findUnique({ where: { id: hubId }, select: { id: true, userId: true, community: true } })
  if (!hub || !hub.community) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const drop = await db.hubDrop.findFirst({ where: { id: dropId, hubId }, select: { id: true, authorId: true, url: true, thumbnailUrl: true } })
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
  if (token) {
    const { del } = await import('@vercel/blob')
    await del([r.drop.url, r.drop.thumbnailUrl].filter(Boolean) as string[], { token }).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; dropId: string }> }): Promise<NextResponse> {
  const { id, dropId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await load(id, dropId)
  if (r.error) return r.error
  if (!canModerate(me.id, r.hub, r.collabIds)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const hidden = body?.hidden === true
  await db.hubDrop.update({ where: { id: dropId }, data: { hidden } })
  return NextResponse.json({ ok: true })
}
