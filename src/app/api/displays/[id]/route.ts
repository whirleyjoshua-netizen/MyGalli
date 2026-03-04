import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

// GET /api/displays/[id] - Get a display
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getUser(request)

    const display = await db.display.findUnique({
      where: { id },
      include: {
        user: {
          select: { username: true, name: true, avatar: true },
        },
      },
    })

    if (!display) {
      return NextResponse.json({ error: 'Display not found' }, { status: 404 })
    }

    // Only owner can see unpublished displays
    if (!display.published && display.userId !== user?.id) {
      return NextResponse.json({ error: 'Display not found' }, { status: 404 })
    }

    // Increment views for published displays viewed by non-owners
    if (display.published && display.userId !== user?.id) {
      await db.display.update({
        where: { id },
        data: { views: { increment: 1 } },
      })
    }

    return NextResponse.json(display)
  } catch (error) {
    console.error('GET /api/displays/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/displays/[id] - Update a display
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const display = await db.display.findUnique({ where: { id } })

    if (!display || display.userId !== user.id) {
      return NextResponse.json({ error: 'Display not found' }, { status: 404 })
    }

    const updates = await request.json()
    const { title, description, published, sections, background, headerCard, tabs } = updates

    const updated = await db.display.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(published !== undefined && { published }),
        ...(sections !== undefined && { sections }),
        ...(background !== undefined && { background }),
        ...(headerCard !== undefined && { headerCard }),
        ...(tabs !== undefined && { tabs }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/displays/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/displays/[id] - Delete a display
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const display = await db.display.findUnique({ where: { id } })

    if (!display || display.userId !== user.id) {
      return NextResponse.json({ error: 'Display not found' }, { status: 404 })
    }

    await db.display.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/displays/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
