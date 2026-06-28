export function isSelfFollow(followerId: string, followingId: string): boolean {
  return followerId === followingId
}

export function deriveFriend(isFollowing: boolean, isFollowedBy: boolean): boolean {
  return isFollowing && isFollowedBy
}
