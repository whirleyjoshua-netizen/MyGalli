import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createToken } from '@/lib/auth-tokens'
import { sendEmail, resetEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 5, windowMs: 60_000, prefix: 'forgot' })
  if (limited) return limited
  try {
    const { email } = await request.json()
    if (typeof email === 'string' && email.includes('@')) {
      const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true } })
      if (user) {
        const token = await createToken(user.id, 'reset')
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const { subject, html } = resetEmail(`${appUrl}/reset?token=${token}`)
        await sendEmail({ to: user.email, subject, html })
      }
    }
    return NextResponse.json({ sent: true }) // never reveal whether the email exists
  } catch (e) {
    console.error('Forgot error:', e)
    return NextResponse.json({ sent: true })
  }
}
