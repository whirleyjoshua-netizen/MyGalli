export const HUB_REACTION_EMOJI = ['❤️', '👍', '😂', '🎉', '😮', '😢'] as const
export type HubReactionEmoji = (typeof HUB_REACTION_EMOJI)[number]

export function isHubReactionEmoji(v: unknown): v is HubReactionEmoji {
  return typeof v === 'string' && (HUB_REACTION_EMOJI as readonly string[]).includes(v)
}

export type ReactionSummary = { counts: Record<string, number>; mine: string[] }

export function summarizeReactions(
  rows: { emoji: string; userId: string }[],
  meId?: string,
): ReactionSummary {
  const counts: Record<string, number> = {}
  const mine: string[] = []
  for (const r of rows) {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1
    if (meId && r.userId === meId) mine.push(r.emoji)
  }
  return { counts, mine }
}
