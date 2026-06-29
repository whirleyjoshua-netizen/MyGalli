'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Plus,
  Home,
  FileText,
  Users,
  Compass,
  LayoutTemplate,
  Blocks,
  ChevronLeft,
  ChevronDown,
  LogOut,
  BarChart3,
  UserCircle,
} from 'lucide-react'
import { Wordmark } from '@/components/brand/Wordmark'
import { useAuthStore } from '@/lib/store'
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
  { label: 'My Pages', icon: FileText, href: '/my-pages', match: (p) => p.startsWith('/my-pages') },
  { label: 'Shared with me', icon: Users, href: '/shared', match: (p) => p.startsWith('/shared') },
  { label: 'Explore', icon: Compass, href: '/explore', match: (p) => p.startsWith('/explore') },
  { label: 'Analytics', icon: BarChart3, href: '/analytics', match: (p) => p.startsWith('/analytics') },
  { label: 'Templates', icon: LayoutTemplate, soon: true },
  { label: 'Apps', icon: Blocks, href: '/apps', match: (p) => p.startsWith('/apps') },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const initial = (user?.name || user?.username || '?').charAt(0).toUpperCase()

  return (
    <aside
      className={`${
        collapsed ? 'w-[76px]' : 'w-64'
      } shrink-0 h-screen sticky top-0 bg-sidebar border-r border-border flex flex-col px-3 py-4 transition-[width] duration-200`}
    >
      {/* Brand + collapse */}
      <div className="flex items-center justify-between px-2 mb-5 h-9">
        {!collapsed && (
          <Link href="/dashboard" className="text-2xl">
            <Wordmark />
          </Link>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Create New */}
      <Link
        href="/editor"
        className={`flex items-center ${
          collapsed ? 'justify-center' : 'justify-between'
        } gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-soft hover:brightness-105 transition-all cursor-pointer`}
      >
        {!collapsed && <span>Create New</span>}
        <Plus className="w-4 h-4 shrink-0" />
      </Link>

      {/* Nav */}
      <nav className="mt-5 flex flex-col gap-1">
        {NAV.map((item) => {
          const active = item.href && (item.match ? item.match(pathname) : pathname === item.href.split('?')[0])
          const Icon = item.icon
          const base = `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            collapsed ? 'justify-center' : ''
          }`
          if (item.soon) {
            return (
              <div
                key={item.label}
                className={`${base} text-muted-foreground/70 cursor-default`}
                title="Coming soon"
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      Soon
                    </span>
                  </>
                )}
              </div>
            )
          }
          return (
            <Link
              key={item.label}
              href={item.href!}
              className={`${base} cursor-pointer ${
                active
                  ? 'bg-primary/10 text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
      {!collapsed && <ProfileCard />}

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className={`w-full flex items-center gap-2.5 p-2 rounded-xl border border-border bg-surface hover:bg-muted transition-colors cursor-pointer ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {user?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          ) : (
            <span className="w-8 h-8 rounded-lg bg-primary/15 text-primary font-bold text-sm flex items-center justify-center shrink-0">
              {initial}
            </span>
          )}
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold truncate">{user?.name || user?.username || 'You'}</p>
                <p className="text-[11px] text-muted-foreground truncate">@{user?.username}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </>
          )}
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-surface border border-border rounded-xl shadow-soft-lg py-1 overflow-hidden">
              <Link
                href={user?.username ? `/${user.username}` : '#'}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <UserCircle className="w-4 h-4" />
                View profile
              </Link>
              <div className="border-t border-border">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Log out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
