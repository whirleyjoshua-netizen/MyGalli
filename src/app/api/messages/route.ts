import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { getUser, getJwtSecret } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { createNotification } from '@/lib/notifications'

interface MailboxNode { id: string; type: string; mailboxRequireName?: boolean }

// Deep-walk the display JSON for a `mailbox` element with the given id.
function findMailboxElement(json: unknown, elementId: string): MailboxNode | null {
  let found: MailboxNode | null = null
  const walk = (node: unknown) => {
    if (found) return
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>
      if (obj.type === 'mailbox' && obj.id === elementId) { found = obj as unknown as MailboxNode; return }
      for (const v of Object.values(obj)) walk(v)
    }
  }
  walk(json)
  return found
}

// POST — public submit
export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'messages-submit' })
  if (limited) return limited

  let b: Record<string, unknown>
  try { b = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  // Honeypot: silently accept, do not persist.
  if (typeof b.hp === 'string' && b.hp.trim() !== '') return NextResponse.json({ ok: true })

  const displayId = String(b.displayId ?? '')
  const elementId = String(b.elementId ?? '')
  const kind = b.kind === 'audio' ? 'audio' : 'text'
  const body = typeof b.body === 'string' ? b.body.trim() : ''
  const mediaUrl = typeof b.mediaUrl === 'string' ? b.mediaUrl : ''
  const senderName = typeof b.senderName === 'string' ? b.senderName.trim() : ''
  const senderEmail = typeof b.senderEmail === 'string' ? b.senderEmail.trim() : ''

  if (!displayId || !elementId) return NextResponse.json({ error: 'Missing target' }, { status: 400 })
  if (!body && !mediaUrl) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  const display = await db.display.findUnique({
    where: { id: displayId },
    select: { id: true, userId: true, title: true, published: true, sections: true, tabs: true },
  })
  if (!display || !display.published) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const el = findMailboxElement(display.sections, elementId) || findMailboxElement(display.tabs, elementId)
  if (!el) return NextResponse.json({ error: 'No such mailbox' }, { status: 400 })
  if (el.mailboxRequireName && !senderName) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const ipHash = createHash('sha256').update(ip + getJwtSecret()).digest('hex').substring(0, 16)

  await db.message.create({
    data: {
      displayId, ownerId: display.userId, elementId, kind,
      body: body || null, mediaUrl: mediaUrl || null,
      senderName: senderName || null, senderEmail: senderEmail || null, ipHash,
    },
  })

  await createNotification({
    userId: display.userId, type: 'message',
    actor: { id: null, name: senderName || 'Someone' },
    entityUrl: '/messages', contextText: display.title,
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}

// GET — owner list
export async function GET(request: NextRequest) {
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = request.nextUrl.searchParams.get('filter')
  const messages = await db.message.findMany({
    where: { ownerId: me.id, ...(filter === 'unread' ? { read: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { display: { select: { title: true, slug: true } } },
  })
  return NextResponse.json({ messages })
}
