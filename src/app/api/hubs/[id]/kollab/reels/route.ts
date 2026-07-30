import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canParticipate, canViewCommunityHub, isUserBanned } from '@/lib/community'
import { sanitizeHubConfig, canStitchReel } from '@/lib/hub-config'
import { rateLimit } from '@/lib/rate-limit'
import { PRESETS, CANDIDATE_CAP, presetWhere, describeCandidates, type Preset } from '@/lib/kollab/candidates'
import { directReel, DirectorError } from '@/lib/kollab/director'
import { validateEdl, edlRuntime, type Edl } from '@/lib/kollab/edl'

const MIN_CANDIDATES = 3
const TARGETS = [15, 30, 45, 60]

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Keyed on the user, not the IP: a stitch is a real Opus call and auth is the
  // only thing gating the spend.
  const limited = await rateLimit(request, { limit: 5, windowMs: 60_000, prefix: 'hub-reel-create', identifier: me.id })
  if (limited) return limited

  const hub = await db.hub.findUnique({
    where: { id },
    select: { id: true, userId: true, community: true, published: true, config: true },
  })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const collabIds = await collaboratorIds(id)
  const isPrivileged = me.id === hub.userId || collabIds.includes(me.id)
  if (!canViewCommunityHub({ published: hub.published, isPrivileged })) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isMember = !!(await db.hubMember.findUnique({
    where: { hubId_userId: { hubId: id, userId: me.id } },
    select: { id: true },
  }))
  const isBanned = await isUserBanned(id, me.id)
  const participates = canParticipate(me.id, hub, collabIds, isMember, isBanned)
  const config = sanitizeHubConfig(hub.config)
  if (!config.kollab.enabled && !isPrivileged) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!canStitchReel({ canParticipate: participates, whoCanStitch: config.kollab.whoCanStitch, isPrivileged })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const preset = (body as any)?.preset
  if (!(PRESETS as readonly string[]).includes(preset)) {
    return NextResponse.json({ error: 'Pick a reel type' }, { status: 400 })
  }
  const rawPrompt = typeof (body as any)?.prompt === 'string' ? (body as any).prompt.trim() : ''
  if (rawPrompt.length > 200) {
    return NextResponse.json({ error: 'Keep the description under 200 characters' }, { status: 400 })
  }
  const prompt = rawPrompt || null
  const targetSec = TARGETS.includes(Number((body as any)?.targetSec)) ? Number((body as any).targetSec) : 30

  const now = new Date()
  const rows = await db.hubDrop.findMany({
    where: presetWhere(preset as Preset, id, now) as any,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: CANDIDATE_CAP,
    select: {
      id: true, type: true, caption: true, durationSec: true, createdAt: true, aiTags: true,
      // url/thumbnailUrl are not sent to the model — they are here only so the
      // 201 response can hydrate without a second query.
      url: true, thumbnailUrl: true,
      author: { select: { username: true } },
    },
  })

  if (rows.length < MIN_CANDIDATES) {
    return NextResponse.json(
      { error: 'There is not enough in the pool yet. Drop a few more clips first.' },
      { status: 400 },
    )
  }

  let raw: unknown
  try {
    raw = await directReel({ digest: describeCandidates(rows, now), preset, prompt, targetSec })
  } catch (error: any) {
    if (error instanceof DirectorError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Kollab reel create error:', error)
    return NextResponse.json({ error: 'Could not build that reel.' }, { status: 500 })
  }

  // The model is untrusted input. Nothing is written until this passes.
  const checked = validateEdl(raw, rows.map((r) => ({ id: r.id, durationSec: r.durationSec })), targetSec)
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 422 })
  const edl: Edl = checked.value

  const reel = await db.kollabReel.create({
    data: { hubId: id, creatorId: me.id, preset, prompt, title: edl.title, edl: edl.clips, status: 'draft' },
    select: { id: true, createdAt: true },
  })

  // Shape-compatible with a GET row on purpose: the client prepends this
  // straight into its reels list, and the Reels tab reads `creator.username`,
  // `creatorId` and `createdAt`. Returning a narrower object here throws in
  // the UI.
  const byId = new Map(rows.map((r) => [r.id, r]))
  return NextResponse.json(
    {
      id: reel.id,
      title: edl.title,
      status: 'draft',
      createdAt: reel.createdAt.toISOString(),
      creatorId: me.id,
      creator: { username: me.username },
      runtimeSec: edlRuntime(edl),
      clips: edl.clips.map((c) => {
        const d = byId.get(c.dropId)!
        return {
          dropId: c.dropId,
          in: c.in,
          out: c.out,
          type: d.type,
          url: (d as any).url,
          thumbnailUrl: (d as any).thumbnailUrl,
          caption: d.caption,
          author: d.author.username,
        }
      }),
    },
    { status: 201 },
  )
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hub = await db.hub.findUnique({
    where: { id },
    select: { id: true, userId: true, community: true, published: true },
  })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const me = await getUser(request)
  const collabIds = await collaboratorIds(id)
  const isPrivileged = !!me && (me.id === hub.userId || collabIds.includes(me.id))
  if (!canViewCommunityHub({ published: hub.published, isPrivileged })) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Drafts are private to their creator; moderators see everything. The public
  // payload never reveals that an unpublished reel exists.
  const where: any = { hubId: id }
  if (!isPrivileged) {
    if (me) where.OR = [{ status: 'published' }, { creatorId: me.id }]
    else where.status = 'published'
  }

  const reels = await db.kollabReel.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 24,
    select: {
      id: true, title: true, status: true, createdAt: true, edl: true, creatorId: true,
      creator: { select: { username: true } },
    },
  })

  const clipsOf = (edl: unknown): { dropId: string; in: number; out: number }[] =>
    Array.isArray(edl)
      ? (edl as any[]).filter((c) => c && typeof c.dropId === 'string' && typeof c.in === 'number' && typeof c.out === 'number')
      : []

  const dropIds = [...new Set(reels.flatMap((r) => clipsOf(r.edl).map((c) => c.dropId)))]

  // Resolved fresh on every read, and only for approved drops. This is what
  // makes moderating a drop propagate to every reel that used it: a rejected or
  // deleted drop simply has no row here, so its clip disappears.
  const drops = dropIds.length
    ? await db.hubDrop.findMany({
        where: { id: { in: dropIds }, hubId: id, status: 'approved' },
        select: {
          id: true, type: true, url: true, thumbnailUrl: true, caption: true, durationSec: true,
          author: { select: { username: true } },
        },
      })
    : []
  const byId = new Map(drops.map((d) => [d.id, d]))

  return NextResponse.json({
    reels: reels.map((r) => {
      const clips = clipsOf(r.edl)
        .map((c) => {
          const d = byId.get(c.dropId)
          if (!d) return null
          return {
            dropId: c.dropId,
            in: c.in,
            out: d.durationSec !== null ? Math.min(c.out, d.durationSec) : c.out,
            type: d.type,
            url: d.url,
            thumbnailUrl: d.thumbnailUrl,
            caption: d.caption,
            author: d.author.username,
          }
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)
      return {
        id: r.id,
        title: r.title,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        creatorId: r.creatorId,
        creator: { username: r.creator.username },
        runtimeSec: clips.reduce((s, c) => s + (c.out - c.in), 0),
        clips,
      }
    }),
  })
}
