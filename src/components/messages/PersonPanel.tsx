'use client'

import Link from 'next/link'
import { User as UserIcon } from 'lucide-react'
import { isOnline } from '@/lib/dm'
import type { DmConversationSummary } from '@/lib/types/dm'
import { initials } from './ConversationRow'

export function PersonPanel({ conversation }: { conversation: DmConversationSummary }) {
  const { other } = conversation
  const display = other.name || `@${other.username}`
  const followsYou = other.followsYou

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col gap-4 border-l border-border p-5 xl:flex">
      <div className="flex flex-col items-center text-center">
        {other.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={other.avatar} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-galli/15 text-lg font-bold text-galli-dark">
            {initials(other.name, other.username)}
          </span>
        )}
        <p className="mt-3 text-base font-bold">{display}</p>
        <p className="text-sm text-muted-foreground">@{other.username}</p>
        {followsYou && <p className="mt-1 text-sm font-medium text-galli-dark">Follows you</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          {isOnline(other.lastSeenAt) ? 'Active now' : 'Offline'}
        </p>
      </div>

      <Link
        href={`/${other.username}`}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
      >
        <UserIcon className="h-4 w-4" /> Profile
      </Link>

      {/* Conversation Notes and Shared Content land here in M2. */}
    </aside>
  )
}
