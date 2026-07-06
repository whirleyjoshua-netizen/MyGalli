'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Plus, Home, FileText, Users, Compass, Library, BarChart3, Megaphone,
} from 'lucide-react'
import { ProfileCard } from '@/components/dashboard/ProfileCard'

interface NavItem {
  label: string
  icon: typeof Home
  href?: string
  soon?: boolean
  match?: (path: string) => boolean
}

const NAV: NavItem[] = [
  { label: 'Home', icon: Home, href: '/dashboard', match: (p) => p === '/dashboard' },
  { label: 'Gallery', icon: FileText, href: '/my-pages', match: (p) => p.startsWith('/my-pages') },
  { label: 'Collaborations', icon: Users, href: '/shared', match: (p) => p.startsWith('/shared') },
  { label: 'Explore', icon: Compass, href: '/explore', match: (p) => p.startsWith('/explore') },
  { label: 'Analytics', icon: BarChart3, href: '/analytics', match: (p) => p.startsWith('/analytics') },
  { label: 'Library', icon: Library, href: '/library', match: (p) => p.startsWith('/library') },
]

// Mobile-only entry: on desktop the bulletin lives in the right-hand panel
// (AnalyticsPanel), which is hidden below xl — so mobile needs its own way in.
const BULLETIN_NAV: NavItem = {
  label: 'Bulletin', icon: Megaphone, href: '/bulletin', match: (p) => p.startsWith('/bulletin'),
}

export function SidebarContent({
  collapsed = false,
  onNavigate,
  mobile = false,
}: {
  collapsed?: boolean
  onNavigate?: () => void
  mobile?: boolean
}) {
  // Insert Bulletin after Explore, mobile drawer only. Desktop rail passes no
  // `mobile`, so its nav is unchanged.
  const nav = mobile
    ? [...NAV.slice(0, 4), BULLETIN_NAV, ...NAV.slice(4)]
    : NAV
  const pathname = usePathname()

  return (
    <>
      {/* Create New */}
      <Link
        href="/editor"
        onClick={onNavigate}
        className={`flex items-center ${
          collapsed ? 'justify-center' : 'justify-between'
        } gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-soft hover:brightness-105 transition-all cursor-pointer`}
      >
        {!collapsed && <span>Create New</span>}
        <Plus className="w-4 h-4 shrink-0" />
      </Link>

      {/* Nav */}
      <nav className="mt-5 flex flex-col gap-1">
        {nav.map((item) => {
          const active = item.href && (item.match ? item.match(pathname) : pathname === item.href.split('?')[0])
          const Icon = item.icon
          const base = `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            collapsed ? 'justify-center' : ''
          }`
          if (item.soon) {
            return (
              <div key={item.label} className={`${base} text-muted-foreground/70 cursor-default`} title="Coming soon">
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Soon</span>
                  </>
                )}
              </div>
            )
          }
          return (
            <Link
              key={item.label}
              href={item.href!}
              onClick={onNavigate}
              className={`${base} cursor-pointer ${
                active ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-primary' : ''}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="flex-1" />

      {/* Profile ID card */}
      <ProfileCard collapsed={collapsed} />
    </>
  )
}
