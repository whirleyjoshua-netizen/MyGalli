'use client'

import Link from 'next/link'
import { Users, Crown } from 'lucide-react'
import type { PondCommunity } from '@/lib/pond'
import { timeAgo } from '@/lib/time-ago'

function RoleBadge({ role }: { role: 'owner' | 'member' }) {
  return role === 'owner' ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
      <Crown className="w-3 h-3" /> Owner
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
      Member
    </span>
  )
}

export function CommunityCard({ community, view }: { community: PondCommunity; view: 'grid' | 'list' }) {
  const href = `/${community.username}/hub/${community.slug}`
  const activity = community.latestPost?.createdAt ?? community.updatedAt
  const desc = community.latestPost?.text || 'No posts yet'

  if (view === 'list') {
    return (
      <Link href={href} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-3 shadow-soft hover:shadow-soft-lg hover:border-primary/30 transition-all">
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-galli/20 to-galli-violet/20">
          {community.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={community.coverImage} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{community.title}</h3>
            <RoleBadge role={community.role} />
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{desc}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {community.memberCount} members</span>
            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Active {timeAgo(activity)} ago</span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={href} className="group flex flex-col rounded-2xl border border-border bg-surface overflow-hidden shadow-soft hover:shadow-soft-lg hover:border-primary/30 transition-all">
      <div className="relative h-32 bg-gradient-to-br from-galli/20 to-galli-violet/20">
        {community.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={community.coverImage} alt="" className="w-full h-full object-cover" />
        )}
        <span className="absolute top-2 right-2"><RoleBadge role={community.role} /></span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold truncate group-hover:text-primary transition-colors">{community.title}</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1 truncate">{desc}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3">
          <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {community.memberCount} members</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Active {timeAgo(activity)} ago
        </div>
      </div>
    </Link>
  )
}
