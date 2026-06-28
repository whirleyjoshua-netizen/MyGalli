import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const { id, userId } = await params
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const display = await db.display.findUnique({ where: { id }, select: { userId: true } })
    if (!display) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // owner can remove anyone; a collaborator may remove themselves
    if (display.userId !== me.id && me.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await db.displayCollaborator.deleteMany({ where: { displayId: id, userId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Collab remove error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
