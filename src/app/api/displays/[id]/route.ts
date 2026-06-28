import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canEdit, splitUpdate, COLLAB_FIELDS } from '@/lib/collab'

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
        collaborators: { select: { userId: true } },
      },
    })

    if (!display) {
      return NextResponse.json({ error: 'Display not found' }, { status: 404 })
    }

    const collaboratorIds = display.collaborators.map((c) => c.userId)
    const viewerCanEdit = canEdit(user?.id ?? null, display.userId, collaboratorIds)

    // Only owner or collaborator can see unpublished displays
    if (!display.published && !viewerCanEdit) {
      return NextResponse.json({ error: 'Display not found' }, { status: 404 })
    }

    // Increment views for published displays viewed by non-editors
    if (display.published && !viewerCanEdit) {
      await db.display.update({
        where: { id },
        data: { views: { increment: 1 } },
      })
    }

    return NextResponse.json({
      ...display,
      isOwner: display.userId === (user?.id ?? null),
      canEdit: viewerCanEdit,
    })
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

    const display = await db.display.findUnique({
      where: { id },
      include: { collaborators: { select: { userId: true } } },
    })

    if (!display) {
      return NextResponse.json({ error: 'Display not found' }, { status: 404 })
    }

    const collaboratorIds = display.collaborators.map((c) => c.userId)
    const isOwner = display.userId === user.id
    if (!canEdit(user.id, display.userId, collaboratorIds)) {
      return NextResponse.json({ error: 'Display not found' }, { status: 404 })
    }

    const body = await request.json()
    const { version: clientVersion, ...updates } = body

    // Only pass through known fields, then split owner-only vs collaborator-allowed
    const known: Record<string, unknown> = {}
    for (const k of ['title', 'description', 'published', 'sections', 'background', 'headerCard', 'tabs', 'coverImage']) {
      if (updates[k] !== undefined) known[k] = updates[k]
    }
    const { data, rejected } = splitUpdate(known, isOwner)
    if (rejected.length > 0) {
      return NextResponse.json({ error: `Not allowed to edit: ${rejected.join(', ')}` }, { status: 403 })
    }

    // Optimistic concurrency applies only to content fields (not publish/title-only changes)
    const touchesContent = Object.keys(data).some((k) => (COLLAB_FIELDS as readonly string[]).includes(k))
    if (touchesContent && typeof clientVersion === 'number' && clientVersion !== display.version) {
      return NextResponse.json({ error: 'Version conflict', currentVersion: display.version }, { status: 409 })
    }

    const updated = await db.display.update({
      where: { id },
      data: { ...data, ...(touchesContent ? { version: { increment: 1 } } : {}) },
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
