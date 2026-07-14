import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canEdit, splitUpdate, COLLAB_FIELDS } from '@/lib/collab'
import { isValidCategory } from '@/lib/categories'
import { notifyFollowers } from '@/lib/notifications'
import { findLiveFeedIds } from '@/lib/live-feed-reconcile'

type SectionsShape = Array<{ columns?: Array<{ elements?: Array<Record<string, unknown>> }> }>

// The transient `collectionMembers` field (hydrated client-side for collection-view
// elements) must never be persisted — strip it before writing sections to the DB.
function stripCollectionMembers(sections: unknown): unknown {
  if (!Array.isArray(sections)) return sections
  return (sections as SectionsShape).map((section) => ({
    ...section,
    columns: Array.isArray(section.columns)
      ? section.columns.map((column) => ({
          ...column,
          elements: Array.isArray(column.elements)
            ? column.elements.map((el) => {
                if (el && typeof el === 'object' && 'collectionMembers' in el) {
                  const { collectionMembers: _omit, ...rest } = el
                  return rest
                }
                return el
              })
            : column.elements,
        }))
      : section.columns,
  }))
}

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

    // NOTE: page views are counted once, in POST /api/analytics/track (eventType
    // 'view', deduped per session via PageViewTracker). Do NOT increment here — a
    // second increment double-counts and corrupts the explore "popular" ranking.

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
    for (const k of ['title', 'description', 'published', 'sections', 'background', 'spacing', 'headerCard', 'tabs', 'coverImage', 'category']) {
      if (updates[k] !== undefined) known[k] = updates[k]
    }
    const { data, rejected } = splitUpdate(known, isOwner)
    if (rejected.length > 0) {
      return NextResponse.json({ error: `Not allowed to edit: ${rejected.join(', ')}` }, { status: 403 })
    }

    if (data.sections !== undefined) {
      data.sections = stripCollectionMembers(data.sections) as typeof data.sections
    }

    if (data.category !== undefined && data.category !== null && !isValidCategory(String(data.category))) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
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

    // Reconcile live-feed rows: ensure a LiveFeed row exists for every
    // live-feed element in the saved content (id = element id). Idempotent.
    try {
      const liveIds = Array.from(new Set([
        ...findLiveFeedIds(updated.sections),
        ...findLiveFeedIds(updated.tabs),
        ...findLiveFeedIds(updated.headerCard),
      ]))
      if (liveIds.length > 0) {
        await db.liveFeed.createMany({
          data: liveIds.map((lfId) => ({ id: lfId, displayId: id })),
          skipDuplicates: true,
        })
      }
    } catch (err) {
      console.error('live-feed reconcile failed:', err)
    }

    if (data.published === true && display.published === false) {
      await notifyFollowers(user.id, {
        type: 'page_published',
        actor: { id: user.id, name: user.name || user.username, avatar: user.avatar },
        entityUrl: `/${user.username}/${display.slug}`,
        contextText: (data.title as string | undefined) ?? display.title,
      })
    }

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
