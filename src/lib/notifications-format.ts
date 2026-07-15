export type NotificationType = 'follow' | 'bulletin' | 'page_published' | 'comment' | 'hub_collaborator' | 'message' | 'hub_member' | 'hub_post' | 'hub_comment'

export function formatNotification(n: { type: string; actorName: string; contextText?: string | null }): string {
  switch (n.type) {
    case 'follow':
      return `${n.actorName} started following you`
    case 'bulletin':
      return `${n.actorName} posted a bulletin`
    case 'page_published':
      return `${n.actorName} published ${n.contextText ? `“${n.contextText}”` : 'a new page'}`
    case 'comment':
      return `${n.actorName} commented on ${n.contextText ? `“${n.contextText}”` : 'your page'}`
    case 'hub_collaborator':
      return `${n.actorName} invited you to a hub`
    case 'message':
      return `${n.actorName} sent you a message${n.contextText ? ` on “${n.contextText}”` : ''}`
    case 'hub_member':
      return `${n.actorName} joined ${n.contextText ? `“${n.contextText}”` : 'your community'}`
    case 'hub_post':
      return `${n.actorName} posted in ${n.contextText ? `“${n.contextText}”` : 'a community'}`
    case 'hub_comment':
      return `${n.actorName} commented on your post${n.contextText ? ` in “${n.contextText}”` : ''}`
    default:
      return n.actorName
  }
}
