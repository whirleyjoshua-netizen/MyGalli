import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { createToken } from '@/lib/auth-tokens'
import { sendEmail, verificationEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 5, windowMs: 60_000, prefix: 'resend-verify' })
  if (limited) return limited
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const fresh = await db.user.findUnique({ where: { id: me.id }, select: { email: true, emailVerified: true } })
    if (!fresh) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (fresh.emailVerified) return NextResponse.json({ sent: true }) // already verified, no-op
    const token = await createToken(me.id, 'verify')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const { subject, html } = verificationEmail(`${appUrl}/verify?token=${token}`)
    await sendEmail({ to: fresh.email, subject, html })
    return NextResponse.json({ sent: true })
  } catch (e) {
    console.error('Resend verify error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
