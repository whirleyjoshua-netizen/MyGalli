import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { getJwtSecret } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { isValidEmail, findLeadGenElement } from '@/lib/lead-gen'
import { sendEmail, leadGenEmail } from '@/lib/email'

interface Props { params: Promise<{ displayId: string }> }

// Public, unauthenticated: a visitor trades an email for the element's payload.
// The message and file are resolved from the STORED display, never from the
// request body — otherwise a crafted POST would turn this into an open relay
// that sends attacker-chosen content from our sending domain.
export async function POST(request: NextRequest, { params }: Props) {
  const limited = await rateLimit(request, { limit: 30, windowMs: 60_000, prefix: 'lead-gen' })
  if (limited) return limited

  const { displayId } = await params

  let b: Record<string, unknown>
  try {
    b = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Honeypot: silently accept so the bot sees success, but persist nothing.
  if (typeof b.hp === 'string' && b.hp.trim() !== '') return NextResponse.json({ ok: true })

  const elementId = String(b.elementId ?? '')
  const email = String(b.email ?? '').trim()
  const name = typeof b.name === 'string' ? b.name.trim() : ''

  if (!elementId) return NextResponse.json({ error: 'Missing element' }, { status: 400 })
  if (!isValidEmail(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })

  const display = await db.display.findUnique({
    where: { id: displayId },
    select: { id: true, published: true, sections: true, tabs: true },
  })
  if (!display || !display.published) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const el =
    findLeadGenElement(display.sections, elementId) || findLeadGenElement(display.tabs, elementId)
  if (!el) return NextResponse.json({ error: 'No such element' }, { status: 400 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const ipHash = createHash('sha256').update(ip + getJwtSecret()).digest('hex').substring(0, 16)

  const lead = await db.leadCapture.create({
    data: { displayId, elementId, email, name: name || null, ipHash },
  })

  // Delivery failure must not lose the lead: the row is already committed, so a
  // bounced send leaves delivered=false for the owner to see rather than 500ing
  // the visitor after we've taken their email.
  try {
    const { subject, html } = leadGenEmail({
      name: name || undefined,
      message: el.leadGenMessage || 'Thanks!',
      fileUrl: el.leadGenFileUrl,
      fileName: el.leadGenFileName,
    })
    await sendEmail({ to: email, subject, html })
    await db.leadCapture.update({ where: { id: lead.id }, data: { delivered: true } })
  } catch (err) {
    console.error('lead-gen delivery failed:', err)
  }

  return NextResponse.json({ ok: true, fileUrl: el.leadGenFileUrl, fileName: el.leadGenFileName })
}
