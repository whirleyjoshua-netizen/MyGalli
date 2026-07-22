import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate } from '@/lib/community'

type Ctx = { params: Promise<{ id: string; pageId: string }> }

async function load(request: NextRequest, id: string, pageId: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, published: true } })
  if (!hub || !hub.community) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const row = await db.hubPage.findUnique({ where: { id: pageId }, select: { id: true, hubId: true, addedById: true, status: true } })
  // Guard the hub match too: a row id from another hub must not be actionable here.
  if (!row || row.hubId !== id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const collabRows = await db.hubCollaborator.findMany({ where: { hubId: id }, select: { userId: true } })
  const isPrivileged = canModerate(me.id, hub, collabRows.map((r) => r.userId))
  return { me, row, isPrivileged }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id, pageId } = await params
  const ctx = await load(request, id, pageId)
  if ('error' in ctx) return ctx.error
  if (!ctx.isPrivileged) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const status = body?.status
  if (status !== 'approved' && status !== 'rejected') {
    return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 })
  }

  const updated = await db.hubPage.update({
    where: { id: pageId },
    data: { status, reviewedAt: new Date(), reviewedById: ctx.me.id },
  })
  return NextResponse.json({ id: updated.id, status: updated.status })
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id, pageId } = await params
  const ctx = await load(request, id, pageId)
  if ('error' in ctx) return ctx.error
  if (!ctx.isPrivileged && ctx.row.addedById !== ctx.me.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await db.hubPage.delete({ where: { id: pageId } })
  return NextResponse.json({ ok: true })
}
