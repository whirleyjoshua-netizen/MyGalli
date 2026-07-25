export type HubPageStatus = 'pending' | 'approved' | 'rejected'

export type HubPageDTO = {
  id: string
  displayId: string
  title: string
  slug: string
  coverImage: string | null
  ownerUsername: string
  status: HubPageStatus
  addedById: string
  createdAt: string
}

export function toHubPageDTO(row: {
  id: string
  displayId: string
  status: string
  addedById: string
  createdAt: Date
  display: { title: string; slug: string; coverImage: string | null; user: { username: string } }
}): HubPageDTO {
  return {
    id: row.id,
    displayId: row.displayId,
    title: row.display.title,
    slug: row.display.slug,
    coverImage: row.display.coverImage,
    ownerUsername: row.display.user.username,
    status: row.status as HubPageStatus,
    addedById: row.addedById,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * The single source of truth for who sees which attachment.
 *
 * Approved rows are public only while the underlying Page is still published —
 * unpublishing hides the card but keeps the row, so re-publishing restores it
 * without a second approval. This holds for every viewer, including the row's
 * own author: an approved-but-unpublished row is never resurfaced via the
 * "own rows" clause. A member always sees their own pending or rejected rows
 * (so a submission does not silently vanish); moderators additionally see the
 * pending queue. Rejected rows are never visible to anyone but their author.
 */
export function visibleHubPageWhere(input: {
  hubId: string
  viewerId: string | null
  isPrivileged: boolean
}) {
  const { hubId, viewerId, isPrivileged } = input
  const approved = { status: 'approved', display: { is: { published: true } } }
  if (!viewerId) return { hubId, ...approved }

  // Own rows are surfaced only in `pending`/`rejected` — never `approved` — so
  // an approved row whose Display has since been unpublished stays subject to
  // the same published requirement for every viewer, author included.
  const or: Record<string, unknown>[] = [
    approved,
    { addedById: viewerId, status: { in: ['pending', 'rejected'] } },
  ]
  if (isPrivileged) or.push({ status: 'pending' })
  return { hubId, OR: or }
}

/** Shared Prisma join for hydrating `toHubPageDTO` — keep both call sites in sync. */
export const HUB_PAGE_DISPLAY_SELECT = {
  display: { select: { title: true, slug: true, coverImage: true, user: { select: { username: true } } } },
} as const

/**
 * Shared ordering for hub page listings. Each entry is individually `as const`
 * rather than the whole array — Prisma's `orderBy` wants a mutable array of
 * literal-typed sort directions, and a top-level `as const` would produce a
 * readonly tuple that its generated types reject.
 */
export const HUB_PAGE_ORDER_BY = [{ order: 'asc' as const }, { createdAt: 'desc' as const }]
