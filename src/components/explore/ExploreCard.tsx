'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Eye, Trophy, FileText, Layout, LayoutGrid } from 'lucide-react'
import { FollowButton } from '@/components/social/FollowButton'

const GRADIENTS = [
  'from-galli/20 via-galli-aqua/10 to-galli-violet/5',
  'from-galli-aqua/20 via-galli-violet/10 to-galli/5',
  'from-galli-violet/20 via-galli/10 to-galli-aqua/5',
  'from-galli/15 via-galli-aqua/8 to-transparent',
  'from-galli-violet/15 via-galli/8 to-transparent',
  'from-galli-aqua/15 via-galli-violet/8 to-transparent',
]

interface ExploreCardProps {
  display: {
    id: string
    slug: string
    title: string
    description: string | null
    views: number
    createdAt: string
    kind?: string
    kitConfig: unknown
    headerCard: unknown
    background: unknown
    user: { username: string; name: string | null; avatar: string | null }
  }
  index: number
}

function parseKitConfig(raw: unknown): { kitId?: string } | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return null }
  }
  return raw as { kitId?: string }
}

function parseHeaderCard(raw: unknown): { photoUrl?: string; coverImageUrl?: string } | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return null }
  }
  return raw as { photoUrl?: string; coverImageUrl?: string }
}

function getKitBadge(kitConfig: unknown) {
  const parsed = parseKitConfig(kitConfig)
  const kitId = parsed?.kitId
  if (kitId === 'athlete') {
    return {
      label: 'Athlete',
      icon: Trophy,
      className: 'bg-galli/15 text-green-700 dark:text-green-300 border border-galli/20',
    }
  }
  if (kitId === 'resume') {
    return {
      label: 'Resume',
      icon: FileText,
      className: 'bg-galli-violet/15 text-violet-700 dark:text-violet-300 border border-galli-violet/20',
    }
  }
  return {
    label: 'Page',
    icon: Layout,
    className: 'bg-muted text-muted-foreground border border-border/50',
  }
}

function getInitials(name: string | null, username: string): string {
  if (name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }
  return username.slice(0, 2).toUpperCase()
}

export function ExploreCard({ display, index }: ExploreCardProps) {
  const badge =
    display.kind === 'collection'
      ? { label: 'Board', icon: LayoutGrid, className: 'bg-galli-violet/15 text-violet-700 dark:text-violet-300 border border-galli-violet/20' }
      : getKitBadge(display.kitConfig)
  const BadgeIcon = badge.icon
  const gradient = GRADIENTS[index % GRADIENTS.length]
  const headerCard = parseHeaderCard(display.headerCard)

  return (
    <Link
      href={`/${display.user.username}/${display.slug}`}
      className="group relative block h-72 rounded-xl border border-border/50 overflow-hidden shadow-sm hover:shadow-md hover:border-galli/30 transition-all duration-200"
    >
      {/* Full-bleed cover */}
      {headerCard?.coverImageUrl ? (
        <Image
          src={headerCard.coverImageUrl}
          alt=""
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : headerCard?.photoUrl ? (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          <Image
            src={headerCard.photoUrl}
            alt=""
            width={72}
            height={72}
            className="rounded-full border-2 border-white/50 shadow-lg"
          />
        </div>
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      )}

      {/* Kit badge */}
      <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium backdrop-blur-sm ${badge.className}`}>
        <BadgeIcon className="w-3 h-3" />
        {badge.label}
      </div>

      {/* View count */}
      {display.views > 0 && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-black/50 text-white backdrop-blur-sm">
          <Eye className="w-3 h-3" />
          {display.views.toLocaleString()}
        </div>
      )}

      {/* scrim for legibility of overlaid info */}
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

      {/* Overlaid info (was the white info area) */}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3 className="text-base font-semibold text-white truncate drop-shadow">
          {display.title}
        </h3>

        {display.description && (
          <p className="text-sm text-white/80 mt-1 line-clamp-2 drop-shadow">
            {display.description}
          </p>
        )}

        {/* Creator row */}
        <div className="flex items-center gap-2 mt-3">
          {display.user.avatar ? (
            <Image
              src={display.user.avatar}
              alt=""
              width={24}
              height={24}
              className="rounded-full border border-white/40"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px] font-bold">
              {getInitials(display.user.name, display.user.username)}
            </div>
          )}
          <span className="text-sm text-white/90 truncate min-w-0 drop-shadow">
            {display.user.name || `@${display.user.username}`}
          </span>
          <span className="ml-auto flex-shrink-0">
            <FollowButton username={display.user.username} initialIsFollowing={false} size="sm" />
          </span>
        </div>
      </div>
    </Link>
  )
}
