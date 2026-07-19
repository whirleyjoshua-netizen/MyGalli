import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canParticipate } from '@/lib/community'
import { sanitizeHubConfig, canDropToPool } from '@/lib/hub-config'
import { blobReadWriteToken } from '@/lib/storage-env'
import { IMAGE_TYPES, MAX_IMAGE, VIDEO_TYPES, MAX_VIDEO } from '@/lib/upload-validate'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = blobReadWriteToken()
  if (!token) return NextResponse.json({ error: 'Uploads unavailable' }, { status: 503 })
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, config: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const collabIds = (await db.hubCollaborator.findMany({ where: { hubId: id }, select: { userId: true } })).map((r) => r.userId)
  const isMember = !!(await db.hubMember.findUnique({ where: { hubId_userId: { hubId: id, userId: me.id } }, select: { id: true } }))
  const isPrivileged = me.id === hub.userId || collabIds.includes(me.id)
  const config = sanitizeHubConfig(hub.config)
  const allowed = canDropToPool({ canParticipate: canParticipate(me.id, hub, collabIds, isMember), whoCanDrop: config.kollab.whoCanDrop, isPrivileged })
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json()) as HandleUploadBody
  try {
    const json = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [...IMAGE_TYPES, ...VIDEO_TYPES],
        maximumSizeInBytes: Math.max(MAX_IMAGE, MAX_VIDEO),
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ userId: me.id, hubId: id }),
      }),
      onUploadCompleted: async () => { /* no-op: client creates the HubDrop row */ },
    })
    return NextResponse.json(json)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
