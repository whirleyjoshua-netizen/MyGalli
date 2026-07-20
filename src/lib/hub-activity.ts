export type ActivityCounts = { newPosts: number; newDrops: number; newMembers: number }
export type ActivityRow = { key: 'posts' | 'clips' | 'members'; label: string }

// Counts arrive from Prisma aggregates, but this helper is also fed by tests and
// (later) by a preview with no data — coerce rather than trusting the caller.
const safe = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

export function activityRows(counts: ActivityCounts): ActivityRow[] {
  const posts = safe(counts.newPosts)
  const clips = safe(counts.newDrops)
  const members = safe(counts.newMembers)
  const rows: ActivityRow[] = []
  if (posts) rows.push({ key: 'posts', label: plural(posts, 'new post', 'new posts') })
  if (clips) rows.push({ key: 'clips', label: plural(clips, 'clip added', 'clips added') })
  if (members) rows.push({ key: 'members', label: plural(members, 'new member', 'new members') })
  return rows
}

export function isQuiet(counts: ActivityCounts): boolean {
  return activityRows(counts).length === 0
}
