import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { touch, active } from '@/lib/presence'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  touch(id, { id: me.id, name: me.name, avatar: me.avatar })
  return NextResponse.json({ active: active(id) })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ active: active(id) })
}
