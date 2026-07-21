'use client'

import { AlertCircle } from 'lucide-react'
import type { DmMessage } from '@/lib/types/dm'

export function MessageBubble({
  message,
  mine,
  onRetry,
}: {
  message: DmMessage
  mine: boolean
  onRetry: (m: DmMessage) => void
}) {
  const time = new Date(message.createdAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          mine ? 'bg-galli/15 text-foreground' : 'bg-muted text-foreground'
        } ${message.pending ? 'opacity-60' : ''}`}
      >
        {message.body && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
        )}
        <div className="mt-1 flex items-center justify-end gap-2">
          {message.failed ? (
            <button
              onClick={() => onRetry(message)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"
            >
              <AlertCircle className="h-3 w-3" /> Not sent · Retry
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              {message.pending ? 'Sending…' : time}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
