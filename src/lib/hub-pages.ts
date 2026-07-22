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
 * without a second approval. A member always sees their own rows (so a pending
 * or rejected submission does not silently vanish); moderators additionally see
 * the pending queue. Rejected rows are never visible to anyone but their author.
 */
export function visibleHubPageWhere(input: {
  hubId: string
  viewerId: string | null
  isPrivileged: boolean
}) {
  const { hubId, viewerId, isPrivileged } = input
  const approved = { status: 'approved', display: { is: { published: true } } }
  if (!viewerId) return { hubId, ...approved }

  const or: Record<string, unknown>[] = [approved, { addedById: viewerId }]
  if (isPrivileged) or.push({ status: 'pending' })
  return { hubId, OR: or }
}
