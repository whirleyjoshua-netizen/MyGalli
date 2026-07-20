export type DmParticipantState = 'accepted' | 'requested' | 'blocked'

export type DmMessageKind = 'text' | 'image' | 'audio' | 'file'

/** A conversation as returned by GET /api/dm/conversations. */
export interface DmConversationSummary {
  id: string
  state: DmParticipantState
  starred: boolean
  muted: boolean
  unreadCount: number
  lastMessageAt: string
  other: {
    id: string
    username: string
    name: string | null
    avatar: string | null
    lastSeenAt: string | null
    /** Does the other person follow me? Drives the "Follows you" line. */
    followsYou: boolean
  }
  preview: {
    body: string | null
    kind: DmMessageKind
    senderId: string
    createdAt: string
  } | null
}

/** A message as returned by GET /api/dm/conversations/[id]/messages. */
export interface DmMessage {
  id: string
  conversationId: string
  senderId: string
  kind: DmMessageKind
  body: string | null
  mediaUrl: string | null
  createdAt: string
  /** Client-only: set while an optimistic send is in flight. */
  pending?: boolean
  /** Client-only: set when an optimistic send failed. */
  failed?: boolean
}
