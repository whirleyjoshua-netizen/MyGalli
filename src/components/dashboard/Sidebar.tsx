'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Wordmark } from '@/components/brand/Wordmark'
import { SidebarContent } from '@/components/dashboard/SidebarContent'

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`${
        collapsed ? 'w-[76px]' : 'w-64'
      } hidden md:flex shrink-0 h-screen sticky top-0 bg-sidebar border-r border-border flex-col px-3 py-4 transition-[width] duration-200`}
    >
      {/* Brand + collapse */}
      <div
        className={`mb-5 ${
          collapsed
            ? 'flex flex-col items-center gap-2'
            : 'flex items-center justify-between px-2 h-9'
        }`}
      >
        <Link href="/dashboard" className="flex items-center gap-2 text-2xl">
          <img src="/gallio-frog.svg" alt="" aria-hidden="true" className="w-7 h-7 shrink-0" />
          {!collapsed && <Wordmark />}
        </Link>
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <SidebarContent collapsed={collapsed} />
    </aside>
  )
}
