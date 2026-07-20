'use client'

import { useEffect, useRef } from 'react'
import { groupByDay, dayLabel, isOnline } from '@/lib/dm'
import type { DmConversationSummary, DmMessage } from '@/lib/types/dm'
import { MessageBubble } from './MessageBubble'

export function MessageThread({
  messages,
  myId,
  conversation,
  onRetry,
}: {
  messages: DmMessage[]
  myId: string
  conversation: DmConversationSummary
  onRetry: (m: DmMessage) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedToBottom = useRef(true)

  // Follow new messages only when the reader is already at the bottom —
  // yanking someone out of history they are reading is worse than not scrolling.
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  const { other } = conversation
  const display = other.name || `@${other.username}`
  const online = isOnline(other.lastSeenAt)
  const groups = groupByDay(messages)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-5 py-3">
        {other.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={other.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-galli/15 text-xs font-bold text-galli-dark">
            {display.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{display}</p>
          <p className="text-xs text-muted-foreground">{online ? 'Active now' : 'Offline'}</p>
        </div>
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet — say hello.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="space-y-3">
              <p data-testid="day-separator" className="text-center text-xs text-muted-foreground">
                {dayLabel(group.key)}
              </p>
              {group.items.map((m) => (
                <MessageBubble key={m.id} message={m} mine={m.senderId === myId} onRetry={onRetry} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
