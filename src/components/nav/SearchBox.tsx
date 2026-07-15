'use client'

import { Search, X } from 'lucide-react'
import type { BarTone } from './tone'

/**
 * Pill chrome for the top-bar search. These classes are the single source of
 * truth — no other component may restate them.
 */
const PILL: Record<BarTone, { form: string; icon: string; input: string }> = {
  glass: {
    form: 'border-white/30 bg-white/15',
    icon: 'text-white/80',
    input: 'text-white placeholder:text-white/70',
  },
  light: {
    form: 'border-border bg-background',
    icon: 'text-muted-foreground',
    input: 'text-foreground placeholder:text-muted-foreground',
  },
}

export function SearchBox({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder = 'Search My Galli pages…',
  tone = 'glass',
}: {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  onClear?: () => void
  placeholder?: string
  tone?: BarTone
}) {
  const pill = PILL[tone]

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.()
      }}
      className={`flex h-10 w-44 items-center gap-2 rounded-full border px-3.5 backdrop-blur-sm sm:w-72 md:w-80 ${pill.form}`}
    >
      <Search className={`h-4 w-4 shrink-0 ${pill.icon}`} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search"
        className={`w-full bg-transparent text-sm outline-none ${pill.input}`}
      />
      {onClear && value && (
        <button type="button" onClick={onClear} aria-label="Clear search">
          <X className={`h-4 w-4 ${pill.icon}`} />
        </button>
      )}
    </form>
  )
}
