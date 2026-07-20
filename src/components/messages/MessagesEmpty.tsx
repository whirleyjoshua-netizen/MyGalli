'use client'

import { MessageSquare, Inbox } from 'lucide-react'

export function MessagesEmpty({ variant }: { variant: 'inbox' | 'thread' }) {
  const copy =
    variant === 'inbox'
      ? {
          Icon: Inbox,
          title: 'No conversations yet',
          body: 'Tap New Message to start a conversation, or wait for one to arrive.',
        }
      : {
          Icon: MessageSquare,
          title: 'Pick a conversation',
          body: 'Choose someone on the left to read and reply.',
        }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-galli/10 text-galli-dark">
        <copy.Icon className="h-6 w-6" />
      </span>
      <p className="text-sm font-bold text-foreground">{copy.title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{copy.body}</p>
    </div>
  )
}
