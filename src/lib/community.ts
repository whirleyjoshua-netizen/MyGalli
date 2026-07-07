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
