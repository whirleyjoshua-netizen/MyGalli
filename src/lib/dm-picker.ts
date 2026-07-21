/**
 * Shapes the viewer's follower + following lists into one picker list.
 *
 * The follower endpoints (`/api/users/[username]/followers|following`) return
 * no `id`, so `username` is the identity here — which is fine, because
 * `POST /api/dm/conversations` also keys off `username`.
 */

export interface SocialRow {
  username: string
  name: string | null
  avatar: string | null
  isFollowing?: boolean
}

export interface PickerUser {
  username: string
  name: string | null
  avatar: string | null
  /** Present in BOTH lists: they follow the viewer and the viewer follows them. */
  isMutual: boolean
}

const displayName = (u: { name: string | null; username: string }) =>
  (u.name || u.username).toLowerCase()

export function mergeSocialGraph(followers: SocialRow[], following: SocialRow[]): PickerUser[] {
  const followerNames = new Set(followers.map((u) => u.username))
  const followingNames = new Set(following.map((u) => u.username))
  const byUsername = new Map<string, PickerUser>()

  // `following` is merged last so its record wins on conflict, but a null
  // field must never overwrite a populated one from the other list.
  for (const row of [...followers, ...following]) {
    const existing = byUsername.get(row.username)
    byUsername.set(row.username, {
      username: row.username,
      name: row.name ?? existing?.name ?? null,
      avatar: row.avatar ?? existing?.avatar ?? null,
      isMutual: followerNames.has(row.username) && followingNames.has(row.username),
    })
  }

  return [...byUsername.values()].sort((a, b) => {
    if (a.isMutual !== b.isMutual) return a.isMutual ? -1 : 1
    return displayName(a).localeCompare(displayName(b))
  })
}

export function filterPickerUsers(users: PickerUser[], query: string): PickerUser[] {
  const q = query.trim().replace(/^@/, '').toLowerCase()
  if (!q) return users
  return users.filter(
    (u) => u.username.toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q)
  )
}
