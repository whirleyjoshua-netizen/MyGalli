import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canEdit } from '@/lib/collab'
import type { Section } from '@/lib/types/canvas'
import { isValidTimeZone, setStamp, clearStamp } from '@/lib/element-stamp'

type Ctx = { params: Promise<{ id: string; elementId: string }> }

const NOT_FOUND = NextResponse.json({ error: 'Display not found' }, { status: 404 })

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
): Promise<{ error: NextResponse } | { sections: Section[] }> {
  const user = await getUser(request)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const display = await db.display.findUnique({
    where: { id },
    include: { collaborators: { select: { userId: true } } },
  })
  if (!display) return { error: NOT_FOUND }

  const collaboratorIds = display.collaborators.map((c) => c.userId)
  if (!canEdit(user.id, display.userId, collaboratorIds)) return { error: NOT_FOUND }

  const sections: Section[] =
    typeof display.sections === 'string'
      ? JSON.parse(display.sections)
      : ((display.sections as unknown as Section[]) ?? [])

  return { sections }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id, elementId } = await params
  const ctx = await load(request, id)
  if ('error' in ctx) return ctx.error

  const body = await request.json().catch(() => ({}))
  // The instant is ALWAYS the server clock. Anything time-like in the body is
  // ignored on purpose — honouring it would turn this into a date picker and
  // let any caller forge a stamp.
  const stampedAt = new Date().toISOString()
  const stampedTz = isValidTimeZone(body?.tz) ? body.tz : undefined

  const next = setStamp(ctx.sections, elementId, stampedAt, stampedTz)
  if (!next) return NOT_FOUND

  await db.display.update({ where: { id }, data: { sections: next as never } })
  return NextResponse.json({ stampedAt, stampedTz })
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id, elementId } = await params
  const ctx = await load(request, id)
  if ('error' in ctx) return ctx.error

  const next = clearStamp(ctx.sections, elementId)
  if (!next) return NOT_FOUND

  await db.display.update({ where: { id }, data: { sections: next as never } })
  return NextResponse.json({ ok: true })
}
