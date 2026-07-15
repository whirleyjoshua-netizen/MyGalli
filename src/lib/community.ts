export type MemberDTO = {
  userId: string
  username: string
  name: string | null
  avatar: string | null
}

export function canPostToHub(
  userId: string,
  hub: { userId: string },
  collaboratorIds: string[],
): boolean {
  return userId === hub.userId || collaboratorIds.includes(userId)
}

export function toMemberDTO(row: {
  userId: string
  user: { username: string; name: string | null; avatar: string | null }
}): MemberDTO {
  return {
    userId: row.userId,
    username: row.user.username,
    name: row.user.name,
    avatar: row.user.avatar,
  }
}

export function canParticipate(
  userId: string,
  hub: { userId: string },
  collaboratorIds: string[],
  isMember: boolean,
): boolean {
  return userId === hub.userId || collaboratorIds.includes(userId) || isMember
}

export function canModerate(
  userId: string,
  hub: { userId: string },
  collaboratorIds: string[],
): boolean {
  return userId === hub.userId || collaboratorIds.includes(userId)
}

/**
 * Who hears about a new community post.
 * Owner/collaborator posts are the broadcast members joined for -> notify every member.
 * Member posts are chatter -> notify owner + collaborators only (moderation awareness).
 * The author never notifies themselves.
 */
export function postNotifyTargets(input: {
  authorId: string
  ownerId: string
  collabIds: string[]
  memberIds: string[]
}): string[] {
  const { authorId, ownerId, collabIds, memberIds } = input
  const isPrivileged = authorId === ownerId || collabIds.includes(authorId)
  const targets = isPrivileged ? memberIds : [ownerId, ...collabIds]
  return [...new Set(targets)].filter((id) => id !== authorId)
}
