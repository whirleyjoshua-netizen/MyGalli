import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail, bookingCancelledEmail } from '@/lib/email'
import { loadApptContext, elementToConfig } from '@/lib/appointments-server'

type Params = { params: Promise<{ token: string }> }

// POST public: cancel a booking via its unguessable token.
export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'appt-cancel' })
  if (limited) return limited

  const booking = await db.booking.findUnique({ where: { cancelToken: token } })
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  await db.booking.delete({ where: { id: booking.id } })

  // Best-effort cancellation emails (config lookup for a nice "when" label).
  // Booking is already deleted at this point, so a send failure here cannot
  // corrupt booking state — it only affects notification delivery.
  const ctx = await loadApptContext(booking.displayId, booking.elementId)
  const tz = ctx ? elementToConfig(ctx.el).timezone : 'UTC'
  const meetingTitle = ctx?.el?.apptTitle || 'Appointment'
  const when =
    new Intl.DateTimeFormat('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' }).format(booking.start) +
    ` (${tz})`
  const mail = bookingCancelledEmail({ name: booking.name, when, meetingTitle })
  await sendEmail({ to: booking.email, ...mail })
  if (ctx) {
    const owner = await db.user.findUnique({ where: { id: ctx.display.userId }, select: { email: true } }).catch(() => null)
    if (owner?.email) await sendEmail({ to: owner.email, ...mail })
  }

  return NextResponse.json({ ok: true })
}
