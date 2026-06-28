import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const display = await db.display.findUnique({ where: { id }, select: { userId: true } })
    if (!display) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const rows = await db.displayCollaborator.findMany({
      where: { displayId: id },
      select: { role: true, user: { select: { id: true, username: true, name: true, avatar: true } } },
    })
    return NextResponse.json({
      isOwner: display.userId === me.id,
      collaborators: rows.map((r) => ({ userId: r.user.id, username: r.user.username, name: r.user.name, avatar: r.user.avatar, role: r.role })),
    })
  } catch (e) {
    console.error('Collab list error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const display = await db.display.findUnique({ where: { id }, select: { userId: true } })
    if (!display) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (display.userId !== me.id) return NextResponse.json({ error: 'Only the owner can invite' }, { status: 403 })

    const { username } = await request.json()
    const invitee = await db.user.findUnique({ where: { username }, select: { id: true } })
    if (!invitee) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (invitee.id === me.id) return NextResponse.json({ error: 'You already own this page' }, { status: 400 })

    // eligibility: owner follows invitee OR invitee follows owner (connection)
    const connection = await db.follow.findFirst({
      where: { OR: [{ followerId: me.id, followingId: invitee.id }, { followerId: invitee.id, followingId: me.id }] },
      select: { id: true },
    })
    if (!connection) return NextResponse.json({ error: 'You can only invite people you follow or who follow you' }, { status: 400 })

    try {
      await db.displayCollaborator.create({ data: { displayId: id, userId: invitee.id, invitedBy: me.id } })
    } catch {
      return NextResponse.json({ error: 'Already a collaborator' }, { status: 409 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Collab invite error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
