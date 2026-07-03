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
