'use client'

import { LayoutGrid, List, Plus } from 'lucide-react'

export function PondHero({
  view, onView, onNewCommunity,
}: {
  view: 'grid' | 'list'; onView: (v: 'grid' | 'list') => void; onNewCommunity: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-6 mb-6">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gallio-frog.svg" alt="" className="w-7 h-7" /> My Pond
        </h1>
        <p className="text-muted-foreground mt-1">Communities you&apos;ve joined and pages you collaborate on.</p>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/pond/hero-sign.png" alt="Your pond is where ideas flow and connections grow." className="hidden lg:block w-[300px] h-auto -mt-2 shrink-0" />

      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center rounded-xl border border-border overflow-hidden">
          <button aria-label="Grid view" onClick={() => onView('grid')} className={`p-2 ${view === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}><LayoutGrid className="w-4 h-4" /></button>
          <button aria-label="List view" onClick={() => onView('list')} className={`p-2 ${view === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}><List className="w-4 h-4" /></button>
        </div>
        <button onClick={onNewCommunity} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90">
          <Plus className="w-4 h-4" /> New community
        </button>
      </div>
    </div>
  )
}
