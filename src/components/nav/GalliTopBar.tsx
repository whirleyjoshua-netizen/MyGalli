'use client'

import type { ReactNode } from 'react'
import { Home, User as UserIcon } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'

export function GalliTopBar({
  search,
  children,
}: {
  search?: ReactNode
  children?: ReactNode
}) {
  const { user } = useAuthStore()
  const initial = (user?.name || user?.username || '?').charAt(0).toUpperCase()

  return (
    <div className="sticky top-0 z-20">
      {/* Gradient bar */}
      <div className="bg-gradient-to-r from-galli via-galli-aqua to-galli-violet text-white shadow-soft-lg">
        <div className="flex items-center px-4 py-3 sm:px-8">
          {/* Left — home */}
          <div className="flex flex-1 justify-start">
            <Link
              href={user ? '/dashboard' : '/'}
              aria-label="Home"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            >
              <Home className="h-5 w-5" />
            </Link>
          </div>

          {/* Center — brand + search slot */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/90 shadow-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/gallio-frog.svg" alt="" aria-hidden className="h-7 w-7" />
            </span>
            <span className="hidden text-xl font-extrabold tracking-tight text-white drop-shadow-sm sm:inline">
              My Galli
            </span>
            {search}
          </div>

          {/* Right — avatar or login */}
          <div className="flex flex-1 justify-end">
            {user ? (
              <a href={`/${user.username}`} aria-label="Your profile" className="shrink-0">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatar}
                    alt=""
                    className="h-9 w-9 rounded-full border-2 border-white/60 object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-sm font-bold text-galli-dark">
                    {initial}
                  </span>
                )}
              </a>
            ) : (
              <Link
                href="/login"
                aria-label="Log in"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              >
                <UserIcon className="h-5 w-5" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Optional sub-bar */}
      {children && (
        <div data-testid="subbar" className="border-b border-border bg-surface/80 backdrop-blur">
          <div className="px-4 py-2 sm:px-8">{children}</div>
        </div>
      )}
    </div>
  )
}
