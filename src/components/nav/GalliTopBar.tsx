'use client'

import type { ReactNode } from 'react'
import { Home, User as UserIcon } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import type { BarTone } from './tone'

/**
 * Both tones are frosted glass over whatever sits behind them; they differ
 * only in which way they lean.
 *
 * `glass` mirrors the landing GlassNav but at a higher opacity — that bar
 * always has a dark hero behind it, whereas this one is sticky and must stay
 * legible once it scrolls onto light content.
 *
 * `light` blends into a white page, so its contents invert to dark.
 */
const TONE: Record<
  BarTone,
  { bar: string; button: string; brand: string; frogRing: string; avatar: string; initial: string }
> = {
  glass: {
    bar: 'border-white/20 bg-galli-dark/70 text-white shadow-soft-lg',
    button: 'bg-white/15 text-white hover:bg-white/25',
    brand: 'text-white drop-shadow-sm',
    frogRing: 'bg-white/90 shadow-soft',
    avatar: 'border-white/60',
    initial: 'bg-white/90 text-galli-dark',
  },
  light: {
    bar: 'border-border bg-surface/80 text-foreground shadow-soft',
    button: 'bg-muted text-galli-dark hover:bg-muted/70',
    brand: 'text-galli-dark',
    frogRing: 'bg-galli/10',
    avatar: 'border-border',
    initial: 'bg-muted text-galli-dark',
  },
}

export function GalliTopBar({
  search,
  children,
  tone = 'glass',
}: {
  search?: ReactNode
  children?: ReactNode
  tone?: BarTone
}) {
  const { user } = useAuthStore()
  const initial = (user?.name || user?.username || '?').charAt(0).toUpperCase()
  const t = TONE[tone]

  return (
    <div className="sticky top-0 z-20">
      <div className={`border-b backdrop-blur-md ${t.bar}`}>
        <div className="flex items-center px-4 py-3 sm:px-8">
          {/* Left — home */}
          <div className="flex flex-1 justify-start">
            <Link
              href={user ? '/dashboard' : '/'}
              aria-label="Home"
              className={`flex h-9 w-9 items-center justify-center rounded-full transition ${t.button}`}
            >
              <Home className="h-5 w-5" />
            </Link>
          </div>

          {/* Center — brand + search slot */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.frogRing}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/gallio-frog.svg" alt="" aria-hidden className="h-7 w-7" />
            </span>
            <span
              className={`hidden text-xl font-extrabold tracking-tight sm:inline ${t.brand}`}
            >
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
                    className={`h-9 w-9 rounded-full border-2 object-cover ${t.avatar}`}
                  />
                ) : (
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${t.initial}`}
                  >
                    {initial}
                  </span>
                )}
              </a>
            ) : (
              <Link
                href="/login"
                aria-label="Log in"
                className={`flex h-9 w-9 items-center justify-center rounded-full transition ${t.button}`}
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
