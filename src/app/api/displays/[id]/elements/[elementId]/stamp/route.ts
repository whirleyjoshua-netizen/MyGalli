import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canEdit } from '@/lib/collab'
import type { Section } from '@/lib/types/canvas'
import { isValidTimeZone, setStamp, clearStamp } from '@/lib/element-stamp'

type Ctx = { params: Promise<{ id: string; elementId: string }> }

// A Response body is a single-use stream, so a shared instance can only ever
// serve one caller correctly. Build a fresh response per call instead.
function notFound() {
  return NextResponse.json({ error: 'Display not found' }, { status: 404 })
}

/**
 * Loads the display and checks edit rights.
 *
 * A failed canEdit answers 404, not 403 — the same answer PATCH
 * /api/displays/[id] gives — so this endpoint cannot be used to confirm that
 * some other user's display exists.
 */
async function load(
  request: NextRequest,
  id: string,
): Promise<{ error: NextResponse } | { sections: Section[]; version: number }> {
  const user = await getUser(request)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const display = await db.display.findUnique({
    where: { id },
    include: { collaborators: { select: { userId: true } } },
  })
  if (!display) return { error: notFound() }

  const collaboratorIds = display.collaborators.map((c) => c.userId)
  if (!canEdit(user.id, display.userId, collaboratorIds)) return { error: notFound() }

  const sections: Section[] =
    typeof display.sections === 'string'
      ? JSON.parse(display.sections)
      : ((display.sections as unknown as Section[]) ?? [])

  return { sections, version: display.version }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id, elementId } = await params
    const ctx = await load(request, id)
    if ('error' in ctx) return ctx.error

    const body = await request.json().catch(() => ({}))
    // The instant is ALWAYS the server clock. Anything time-like in the body is
    // ignored on purpose — honouring it would turn this into a date picker and
    // let any caller forge a stamp.
    const stampedAt = new Date().toISOString()
    const stampedTz = isValidTimeZone(body?.tz) ? body.tz : undefined

    // This is a read-modify-write of the whole `sections` blob, same as the
    // `sections` write in PATCH /api/displays/[id] — mirror its optimistic
    // concurrency: an explicit client version is checked against the current
    // row, and every write bumps `version` so a later stale save is caught too.
    const clientVersion = (body as Record<string, unknown> | null)?.version
    if (typeof clientVersion === 'number' && clientVersion !== ctx.version) {
      return NextResponse.json(
        { error: 'Version conflict', currentVersion: ctx.version },
        { status: 409 },
      )
    }

    const next = setStamp(ctx.sections, elementId, stampedAt, stampedTz)
    if (!next) return notFound()

    await db.display.update({
      where: { id },
      data: { sections: next as never, version: { increment: 1 } },
    })
    return NextResponse.json({ stampedAt, stampedTz })
  } catch (error) {
    console.error('POST /api/displays/[id]/elements/[elementId]/stamp error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const { id, elementId } = await params
    const ctx = await load(request, id)
    if ('error' in ctx) return ctx.error

    const body = await request.json().catch(() => ({}))
    const clientVersion = (body as Record<string, unknown> | null)?.version
    if (typeof clientVersion === 'number' && clientVersion !== ctx.version) {
      return NextResponse.json(
        { error: 'Version conflict', currentVersion: ctx.version },
        { status: 409 },
      )
    }

    const next = clearStamp(ctx.sections, elementId)
    if (!next) return notFound()

    await db.display.update({
      where: { id },
      data: { sections: next as never, version: { increment: 1 } },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/displays/[id]/elements/[elementId]/stamp error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
