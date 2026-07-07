import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { isPro } from '@/lib/plan'
import { generateSlots, isSlotBookable } from '@/lib/appointments'
import { loadApptContext, elementToConfig } from '@/lib/appointments-server'
import { sendEmail, bookingConfirmedEmail, bookingReceivedEmail } from '@/lib/email'

type Params = { params: Promise<{ displayId: string }> }
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// GET public: available slots with taken flag. No PII.
export async function GET(request: NextRequest, { params }: Params) {
  const { displayId } = await params
  const elementId = request.nextUrl.searchParams.get('elementId')
  if (!elementId) return NextResponse.json({ error: 'elementId required' }, { status: 400 })
  const limited = await rateLimit(request, { limit: 120, windowMs: 60_000, prefix: `appt-read:${displayId}` })
  if (limited) return limited

  const ctx = await loadApptContext(displayId, elementId)
  if (!ctx || !ctx.display.published) return NextResponse.json({ slots: [], available: false })
  if (!isPro(ctx.display.user)) return NextResponse.json({ slots: [], available: false })

  const config = elementToConfig(ctx.el)
  const now = new Date()
  const to = new Date(now.getTime() + (config.maxDaysAhead + 1) * 86_400_000)
  const slots = generateSlots(config, now, to, now)

  const taken = await db.booking.findMany({
    where: { elementId, start: { gte: now } },
    select: { start: true },
  })
  const takenSet = new Set(taken.map((b) => b.start.toISOString()))
  return NextResponse.json(
    {
      available: true,
      timezone: config.timezone,
      slots: slots.map((s) => ({ ...s, taken: takenSet.has(s.startUTC) })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// POST public: create a booking.
export async function POST(request: NextRequest, { params }: Params) {
  const { displayId } = await params
  const limited = await rateLimit(request, { limit: 10, windowMs: 60_000, prefix: 'appt-book' })
  if (limited) return limited

  let body: { elementId?: string; startUTC?: string; name?: string; email?: string; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const { elementId, startUTC, name, email, note } = body
  if (!elementId || !startUTC || !name || !email) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const ctx = await loadApptContext(displayId, elementId)
  if (!ctx || !ctx.display.published) return NextResponse.json({ error: 'Not available' }, { status: 404 })
  if (!isPro(ctx.display.user)) return NextResponse.json({ error: 'Booking unavailable' }, { status: 403 })

  const config = elementToConfig(ctx.el)
  if (!isSlotBookable(config, startUTC, new Date())) {
    return NextResponse.json({ error: 'Slot not available' }, { status: 400 })
  }

  const start = new Date(startUTC)
  const end = new Date(start.getTime() + config.duration * 60_000)

  let booking
  try {
    booking = await db.booking.create({
      data: {
        displayId,
        elementId,
        start,
        end,
        name: name.slice(0, 120),
        email: email.slice(0, 200),
        note: note?.slice(0, 1000) || null,
      },
    })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'That time was just booked' }, { status: 409 })
    throw e
  }

  const meetingTitle = ctx.el.apptTitle || 'Appointment'
  const when =
    new Intl.DateTimeFormat('en-US', {
      timeZone: config.timezone,
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(start) + ` (${config.timezone})`
  const cancelUrl = `${APP_URL}/appointments/cancel/${booking.cancelToken}`
  const location = ctx.el.apptLocationDetail || undefined

  const owner = await db.user.findUnique({ where: { id: ctx.display.userId }, select: { email: true } })
  const visitorMail = bookingConfirmedEmail({ name, when, meetingTitle, location, cancelUrl })
  await sendEmail({ to: email, ...visitorMail })
  if (owner?.email) {
    const ownerMail = bookingReceivedEmail({ name, when, meetingTitle, location, cancelUrl })
    await sendEmail({ to: owner.email, ...ownerMail })
  }

  return NextResponse.json({ ok: true, when, cancelUrl })
}
