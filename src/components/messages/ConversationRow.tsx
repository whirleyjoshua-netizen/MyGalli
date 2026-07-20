'use client'

import { isOnline } from '@/lib/dm'
import type { DmConversationSummary } from '@/lib/types/dm'

export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const mins = Math.floor((now.getTime() - then.getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return then.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function initials(name: string | null, username: string): string {
  const source = name?.trim() || username
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function ConversationRow({
  conversation,
  active,
  onSelect,
}: {
  conversation: DmConversationSummary
  active: boolean
  onSelect: (id: string) => void
}) {
  const { other, preview, unreadCount } = conversation
  const display = other.name || `@${other.username}`
  const online = isOnline(other.lastSeenAt)

  return (
    <button
      onClick={() => onSelect(conversation.id)}
      className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors ${
        active ? 'bg-muted' : 'hover:bg-muted/60'
      }`}
    >
      <span className="relative shrink-0">
        {other.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={other.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-galli/15 text-sm font-bold text-galli-dark">
            {initials(other.name, other.username)}
          </span>
        )}
        {online && (
          <span
            aria-label="Online"
            className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-galli"
          />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-sm ${unreadCount > 0 ? 'font-bold' : 'font-semibold'}`}>
            {display}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {relativeTime(conversation.lastMessageAt)}
          </span>
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span
            className={`truncate text-sm ${
              unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {preview?.body || 'No messages yet'}
          </span>
          {unreadCount > 0 && (
            <span className="shrink-0 rounded-full bg-galli px-2 py-0.5 text-xs font-bold text-white">
              {unreadCount}
            </span>
          )}
        </span>
      </span>
    </button>
  )
}
