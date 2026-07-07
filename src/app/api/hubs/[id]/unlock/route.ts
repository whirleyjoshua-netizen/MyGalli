import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { readUnlockToken, signUnlockToken } from '@/lib/hub-access'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimit(request, { limit: 10, windowMs: 60_000, prefix: 'hubunlock' })
  if (limited) return limited
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId : ''
  const passcode = typeof body.passcode === 'string' ? body.passcode : ''
  if (!nodeId || !passcode) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  // node may be a folder or an item in this hub
  const folder = await db.hubFolder.findFirst({ where: { id: nodeId, hubId: id }, select: { passcodeHash: true } })
  const item = folder ? null : await db.hubItem.findFirst({ where: { id: nodeId, hubId: id }, select: { passcodeHash: true } })
  const passcodeHash = folder?.passcodeHash ?? item?.passcodeHash ?? null
  if (!passcodeHash || !(await compare(passcode, passcodeHash))) {
    return NextResponse.json({ error: 'Incorrect passcode' }, { status: 401 })
  }
  const cookieName = `hub_unlock_${id}`
  const existing = readUnlockToken(request.cookies.get(cookieName)?.value, id)
  const unlocked = Array.from(new Set([...existing, nodeId]))
  const res = NextResponse.json({ ok: true })
  res.cookies.set(cookieName, signUnlockToken(id, unlocked), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12,
  })
  return res
}
