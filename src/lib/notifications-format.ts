export type NotificationType = 'follow' | 'bulletin' | 'page_published' | 'comment' | 'message'

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
    case 'message':
      return `${n.actorName} sent you a message${n.contextText ? ` on “${n.contextText}”` : ''}`
    default:
      return n.actorName
  }
}
