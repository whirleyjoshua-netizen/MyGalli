// Pure helpers for Collection Boards. No IO — unit-testable. The Prisma fetch
// that produces MemberRow lives in the public page loader and the members API.

export interface CollectionMemberCard {
  id: string
  username: string
  slug: string
  title: string
  description: string | null
  coverImage: string | null
  category: string | null
}

export interface MemberRow {
  memberId: string
  position: number
  member: {
    published: boolean
    slug: string
    title: string
    description: string | null
    coverImage: string | null
    category: string | null
    user: { username: string }
  }
}

// Public-page view: only published members, in manual (position) order.
export function selectVisibleMembers(rows: MemberRow[]): CollectionMemberCard[] {
  return rows
    .filter((r) => r.member.published)
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      id: r.memberId,
      username: r.member.user.username,
      slug: r.member.slug,
      title: r.member.title,
      description: r.member.description,
      coverImage: r.member.coverImage,
      category: r.member.category,
    }))
}

// Map an ordered list of memberIds to 0-based position updates.
export function computePositions(order: string[]): { memberId: string; position: number }[] {
  return order.map((memberId, position) => ({ memberId, position }))
}
