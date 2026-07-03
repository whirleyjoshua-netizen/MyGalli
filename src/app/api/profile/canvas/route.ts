import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { ensureProfileCanvas } from '@/lib/profile-canvas'

export async function POST(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const id = await ensureProfileCanvas(me.id)
    return NextResponse.json({ id })
  } catch (e) {
    console.error('Profile canvas error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
