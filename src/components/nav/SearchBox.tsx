'use client'

import { Search, X } from 'lucide-react'

export function SearchBox({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder = 'Search My Galli pages…',
}: {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  onClear?: () => void
  placeholder?: string
}) {
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.()
      }}
      className="flex h-10 w-44 items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3.5 backdrop-blur-sm sm:w-72 md:w-80"
    >
      <Search className="h-4 w-4 shrink-0 text-white/80" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search"
        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/70"
      />
      {onClear && value && (
        <button type="button" onClick={onClear} aria-label="Clear search">
          <X className="h-4 w-4 text-white/80" />
        </button>
      )}
    </form>
  )
}
