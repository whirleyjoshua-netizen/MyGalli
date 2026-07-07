import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isPro } from '@/lib/plan'
import { descendantFolderIds } from '@/lib/hub-tree'

async function ownHub(request: NextRequest, id: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id } })
  if (!hub || hub.userId !== me.id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { me, hub }
}

async function ownFolder(id: string, folderId: string) {
  const folder = await db.hubFolder.findUnique({ where: { id: folderId } })
  if (!folder || folder.hubId !== id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { folder }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; folderId: string }> }
) {
  const { id, folderId } = await params
  const r = await ownHub(request, id)
  if ('error' in r) return r.error
  const f = await ownFolder(id, folderId)
  if ('error' in f) return f.error

  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name || name.length > 120) {
      return NextResponse.json({ error: 'name must be 1-120 chars' }, { status: 400 })
    }
    data.name = name
  }

  if (body.parentId !== undefined) {
    if (body.parentId === null) {
      data.parentId = null
    } else if (typeof body.parentId === 'string') {
      if (body.parentId === folderId) {
        return NextResponse.json({ error: 'A folder cannot be its own parent' }, { status: 400 })
      }
      const parent = await db.hubFolder.findUnique({ where: { id: body.parentId } })
      if (!parent || parent.hubId !== id) {
        return NextResponse.json({ error: 'Invalid parentId' }, { status: 400 })
      }
      const allFolders = await db.hubFolder.findMany({ where: { hubId: id } })
      const descendants = descendantFolderIds(allFolders, folderId)
      if (descendants.includes(body.parentId)) {
        return NextResponse.json({ error: 'Cannot move a folder into its own descendant' }, { status: 400 })
      }
      data.parentId = body.parentId
    }
  }

  if (typeof body.order === 'number') data.order = body.order

  if (body.visibility === 'private' || (typeof body.passcode === 'string' && body.passcode)) {
    if (!isPro(r.me)) return NextResponse.json({ error: 'Pro required to make items private' }, { status: 403 })
  }
  if (body.visibility === 'public' || body.visibility === 'private') data.visibility = body.visibility
  if (body.passcode === null || body.passcode === '') data.passcodeHash = null
  else if (typeof body.passcode === 'string') data.passcodeHash = await hash(body.passcode, 12)

  const folder = await db.hubFolder.update({ where: { id: folderId }, data })
  const { passcodeHash, ...safeFolder } = folder
  return NextResponse.json({ ...safeFolder, hasPasscode: !!passcodeHash })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; folderId: string }> }
) {
  const { id, folderId } = await params
  const r = await ownHub(request, id)
  if ('error' in r) return r.error
  const f = await ownFolder(id, folderId)
  if ('error' in f) return f.error

  const allFolders = await db.hubFolder.findMany({ where: { hubId: id } })
  const ids = descendantFolderIds(allFolders, folderId)

  await db.$transaction([
    db.hubItem.deleteMany({ where: { folderId: { in: ids } } }),
    db.hubFolder.deleteMany({ where: { id: { in: ids } } }),
  ])

  return NextResponse.json({ ok: true })
}
