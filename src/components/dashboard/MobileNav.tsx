'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Plus } from 'lucide-react'
import { Wordmark } from '@/components/brand/Wordmark'
import { SidebarContent } from '@/components/dashboard/SidebarContent'

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Lock body scroll + close on Escape while the drawer is open.
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Close drawer on route change (browser back button, etc.)
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Close drawer when viewport reaches desktop (≥768px)
  useEffect(() => {
    if (!open) return
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => { if (mq.matches) setOpen(false) }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [open])

  return (
    <>
      {/* Top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-2 h-14 px-3 bg-sidebar border-b border-border">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-2.5 -ml-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/dashboard" className="text-xl">
          <Wordmark />
        </Link>
        <Link
          href="/editor"
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-soft hover:brightness-105 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create
        </Link>
      </header>

      {/* Drawer */}
      {open && (
        <div className="md:hidden">
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />
          {/* Panel */}
          <div className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-sidebar border-r border-border flex flex-col px-3 py-4 overflow-y-auto">
            <div className="flex items-center justify-between px-2 mb-5 h-9">
              <Link href="/dashboard" className="text-2xl" onClick={() => setOpen(false)}>
                <Wordmark />
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent mobile onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
