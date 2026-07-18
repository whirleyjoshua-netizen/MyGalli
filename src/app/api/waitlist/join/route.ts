import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { collectElements, isFull } from '@/lib/waitlist'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'waitlist-join' })
  if (limited) return limited

  const body = await request.json().catch(() => ({}))
  const displayId = typeof body.displayId === 'string' ? body.displayId : ''
  const elementId = typeof body.elementId === 'string' ? body.elementId : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 200) : null

  if (!displayId || !elementId) return NextResponse.json({ error: 'Missing display or element' }, { status: 400 })
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })

  const display = await db.display.findUnique({
    where: { id: displayId },
    select: { id: true, published: true, sections: true },
  })
  if (!display) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!display.published) return NextResponse.json({ error: 'Not published' }, { status: 403 })

  const el = collectElements(display.sections).find((e) => e.id === elementId)
  if (!el || el.type !== 'waitlist') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const capacity = typeof el.waitlistCapacity === 'number' ? el.waitlistCapacity : null

  // Idempotent: an email already on this list returns the current count, no new row.
  const existing = await db.waitlistSignup.findUnique({
    where: { displayId_elementId_email: { displayId, elementId, email } },
  })
  if (existing) {
    const count = await db.waitlistSignup.count({ where: { displayId, elementId } })
    return NextResponse.json({ count }, { status: 200 })
  }

  // Capacity is enforced here — the client's disabled button is only UX.
  const current = await db.waitlistSignup.count({ where: { displayId, elementId } })
  if (isFull(current, capacity)) {
    return NextResponse.json({ error: 'Wait list full' }, { status: 409 })
  }

  const user = await getUser(request)
  await db.waitlistSignup.create({
    data: { displayId, elementId, email, name, userId: user?.id ?? null },
  })
  const count = await db.waitlistSignup.count({ where: { displayId, elementId } })
  return NextResponse.json({ count }, { status: 201 })
}
