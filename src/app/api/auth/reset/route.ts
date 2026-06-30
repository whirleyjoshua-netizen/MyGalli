import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { consumeToken } from '@/lib/auth-tokens'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 10, windowMs: 60_000, prefix: 'reset' })
  if (limited) return limited
  try {
    const { token, password } = await request.json()
    if (!token || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    const userId = await consumeToken(token, 'reset')
    if (!userId) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
    await db.user.update({
      where: { id: userId },
      data: { password: await hash(password, 12), tokenVersion: { increment: 1 } },
    })
    return NextResponse.json({ reset: true })
  } catch (e) {
    console.error('Reset error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
