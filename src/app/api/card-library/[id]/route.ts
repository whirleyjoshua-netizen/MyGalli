import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const item = await db.cardLibraryItem.findUnique({ where: { id } })
    if (!item || item.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, data, style } = body

    const updated = await db.cardLibraryItem.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(data !== undefined && { data }),
        ...(style !== undefined && { style }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/card-library/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const item = await db.cardLibraryItem.findUnique({ where: { id } })
    if (!item || item.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await db.cardLibraryItem.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/card-library/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
