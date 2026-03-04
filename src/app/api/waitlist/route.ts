import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

// POST /api/waitlist — Submit a waitlist entry
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { limit: 5, windowMs: 60_000, prefix: 'waitlist' })
  if (limited) return limited

  try {
    const { email, name, organization, role, message } = await request.json()

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    const entry = await db.waitlistEntry.create({
      data: {
        email: email.trim().toLowerCase(),
        name: name?.trim() || null,
        organization: organization?.trim() || null,
        role: role || null,
        message: message?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, id: entry.id }, { status: 201 })
  } catch (error) {
    console.error('Waitlist submission error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
