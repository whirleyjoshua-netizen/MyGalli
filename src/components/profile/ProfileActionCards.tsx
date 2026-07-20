'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Share2, Pencil, Check } from 'lucide-react'
import { FollowButton } from '@/components/social/FollowButton'
import { ProfileMailboxModal } from '@/components/profile/ProfileMailboxModal'
import { getProfileActionCards } from '@/lib/profile-actions'

const cardCls =
  'flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-soft hover:shadow-soft-lg transition-all min-w-[190px]'

export function ProfileActionCards({
  isOwner,
  username,
  name,
  isFollowing,
  isFriend,
}: {
  isOwner: boolean
  username: string
  name: string | null
  isFollowing: boolean
  isFriend: boolean
}) {
  const [mailboxOpen, setMailboxOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const cards = getProfileActionCards(isOwner)

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${username}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  const Body = ({ label, sublabel }: { label: string; sublabel: string }) => (
    <div className="flex flex-col">
      <span className="font-bold text-sm">{label}</span>
      <span className="text-xs text-muted-foreground">{sublabel}</span>
    </div>
  )

  return (
    <div className="flex flex-wrap gap-3">
      {cards.map((c) => {
        if (c.key === 'mailbox') {
          return (
            <Link key={c.key} href="/messages" className={`${cardCls} cursor-pointer`}>
              <Mail className="w-5 h-5 text-primary shrink-0" />
              <Body label={c.label} sublabel={c.sublabel} />
            </Link>
          )
        }
        if (c.key === 'edit') {
          return (
            <Link key={c.key} href="/profile/edit" className={`${cardCls} cursor-pointer`}>
              <Pencil className="w-5 h-5 text-primary shrink-0" />
              <Body label={c.label} sublabel={c.sublabel} />
            </Link>
          )
        }
        if (c.key === 'message') {
          return (
            <button key={c.key} onClick={() => setMailboxOpen(true)} className={`${cardCls} cursor-pointer text-left`}>
              <Mail className="w-5 h-5 text-primary shrink-0" />
              <Body label={c.label} sublabel={c.sublabel} />
            </button>
          )
        }
        if (c.key === 'share') {
          return (
            <button key={c.key} onClick={copyShare} className={`${cardCls} cursor-pointer text-left`}>
              {copied ? <Check className="w-5 h-5 text-primary shrink-0" /> : <Share2 className="w-5 h-5 text-primary shrink-0" />}
              <Body label={c.label} sublabel={copied ? 'Copied!' : c.sublabel} />
            </button>
          )
        }
        // follow
        return (
          <div key={c.key} className={cardCls}>
            <Body label={c.label} sublabel={`Follow ${name || `@${username}`}`} />
            <div className="ml-auto">
              <FollowButton username={username} initialIsFollowing={isFollowing} initialIsFriend={isFriend} />
            </div>
          </div>
        )
      })}

      {mailboxOpen && (
        <ProfileMailboxModal username={username} name={name} onClose={() => setMailboxOpen(false)} />
      )}
    </div>
  )
}
