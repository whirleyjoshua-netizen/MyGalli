'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Eye, Trophy, FileText, Layout } from 'lucide-react'

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
    kitConfig: unknown
    headerCard: unknown
    background: unknown
    user: { username: string; name: string | null; avatar: string | null }
  }
  index: number
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
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
  const badge = getKitBadge(display.kitConfig)
  const BadgeIcon = badge.icon
  const gradient = GRADIENTS[index % GRADIENTS.length]
  const headerCard = parseHeaderCard(display.headerCard)

  return (
    <Link
      href={`/${display.user.username}/${display.slug}`}
      className="group block rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm hover:shadow-md hover:border-galli/30 transition-all duration-200"
    >
      {/* Preview area */}
      <div className="relative h-36 overflow-hidden">
        {headerCard?.coverImageUrl ? (
          <Image
            src={headerCard.coverImageUrl}
            alt=""
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : headerCard?.photoUrl ? (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <Image
              src={headerCard.photoUrl}
              alt=""
              width={64}
              height={64}
              className="rounded-full border-2 border-white/50 shadow-lg"
            />
          </div>
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient}`} />
        )}

        {/* Kit badge */}
        <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium backdrop-blur-sm ${badge.className}`}>
          <BadgeIcon className="w-3 h-3" />
          {badge.label}
        </div>

        {/* View count */}
        {display.views > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-black/50 text-white backdrop-blur-sm">
            <Eye className="w-3 h-3" />
            {display.views.toLocaleString()}
          </div>
        )}
      </div>

      {/* Info area */}
      <div className="px-4 pb-4 pt-3">
        <h3 className="text-base font-semibold text-foreground truncate group-hover:text-galli transition-colors">
          {display.title}
        </h3>

        {display.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
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
              className="rounded-full"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-galli/20 text-galli-dark flex items-center justify-center text-[10px] font-bold">
              {getInitials(display.user.name, display.user.username)}
            </div>
          )}
          <span className="text-sm text-muted-foreground truncate">
            {display.user.name || `@${display.user.username}`}
          </span>
          <span className="text-xs text-muted-foreground/60 ml-auto flex-shrink-0">
            {timeAgo(display.createdAt)}
          </span>
        </div>
      </div>
    </Link>
  )
}
