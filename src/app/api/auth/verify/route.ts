import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { consumeToken } from '@/lib/auth-tokens'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    if (!token || typeof token !== 'string') return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    const userId = await consumeToken(token, 'verify')
    if (!userId) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
    await db.user.update({ where: { id: userId }, data: { emailVerified: new Date() } })
    return NextResponse.json({ verified: true })
  } catch (e) {
    console.error('Verify error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
