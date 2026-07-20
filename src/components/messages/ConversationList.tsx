'use client'

import type { DmConversationSummary } from '@/lib/types/dm'
import { ConversationRow } from './ConversationRow'

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  loading,
}: {
  conversations: DmConversationSummary[]
  activeId: string | null
  onSelect: (id: string) => void
  loading: boolean
}) {
  if (loading && conversations.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Loading conversations…</p>
  }

  if (conversations.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No conversations yet.
      </p>
    )
  }

  return (
    <div className="divide-y divide-border overflow-y-auto">
      {conversations.map((c) => (
        <ConversationRow
          key={c.id}
          conversation={c}
          active={c.id === activeId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
