'use client'

import Link from 'next/link'
import { ChevronRight, FilePlus2, Eye, Settings, Share2 } from 'lucide-react'

export function QuickActions({
  username,
  slug,
  displayId,
}: {
  username: string | null
  slug: string | null
  displayId: string | null
}) {
  const publicHref = username && slug ? `/${username}/${slug}` : null

  const actions = [
    { label: 'Create New Page', href: '/editor', icon: FilePlus2 },
    ...(publicHref ? [{ label: 'View as Visitor', href: publicHref, icon: Eye }] : []),
    ...(displayId ? [{ label: 'Share Page', href: `/editor?id=${displayId}&share=1`, icon: Share2 }] : []),
    ...(displayId ? [{ label: 'Page Settings', href: `/editor?id=${displayId}`, icon: Settings }] : []),
  ]

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <h3 className="mb-3 text-sm font-bold">Quick Actions</h3>
      <ul className="space-y-1">
        {actions.map(({ label, href, icon: Icon }) => (
          <li key={label}>
            <Link
              href={href}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
