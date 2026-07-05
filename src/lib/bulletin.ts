// Pure bulletin domain helpers: block validation, settings normalization,
// follow-scope, and the results-reveal rule. No IO — unit-testable.

export const BULLETIN_BLOCK_TYPES = ['poll', 'rating', 'shortanswer'] as const
export type BulletinBlockType = (typeof BULLETIN_BLOCK_TYPES)[number]

export interface BulletinSettings {
  revealAfterAnswer: boolean
  liveTally: boolean
}

export function isBulletinBlockType(t: unknown): t is BulletinBlockType {
  return typeof t === 'string' && (BULLETIN_BLOCK_TYPES as readonly string[]).includes(t)
}

export function normalizeSettings(raw: unknown): BulletinSettings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { revealAfterAnswer: !!s.revealAfterAnswer, liveTally: !!s.liveTally }
}

export function isEmptyPost(input: { text?: string | null; imageUrl?: string | null; block?: unknown }): boolean {
  const hasText = !!(input.text && input.text.trim())
  const hasImage = !!(input.imageUrl && input.imageUrl.trim())
  const hasBlock = !!input.block
  return !hasText && !hasImage && !hasBlock
}

export function isInScope(authorId: string, followingIds: string[], myId: string): boolean {
  return authorId === myId || followingIds.includes(authorId)
}

export function resultsVisible(p: { isAuthor: boolean; revealAfterAnswer: boolean; hasResponded: boolean }): boolean {
  return p.isAuthor || !p.revealAfterAnswer || p.hasResponded
}

export function scoreTrending(likeCount: number, responseCount: number): number {
  return likeCount + 2 * responseCount
}

export interface TrendingCandidate {
  id: string
  likeCount: number
  responseCount: number
  createdAt: Date
}

export function rankTrending<T extends TrendingCandidate>(
  items: T[],
  page: number,
  limit: number,
): { pageItems: T[]; total: number } {
  const sorted = [...items].sort((a, b) => {
    const s = scoreTrending(b.likeCount, b.responseCount) - scoreTrending(a.likeCount, a.responseCount)
    if (s !== 0) return s
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
  const start = (page - 1) * limit
  return { pageItems: sorted.slice(start, start + limit), total: sorted.length }
}
