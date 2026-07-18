'use client'

import { Search } from 'lucide-react'
import type { PondFilter, PondSort } from '@/lib/pond'

export function PondToolbar({
  query, onQuery, filter, onFilter, sort, onSort, showFilter,
}: {
  query: string; onQuery: (v: string) => void
  filter: PondFilter; onFilter: (v: PondFilter) => void
  sort: PondSort; onSort: (v: PondSort) => void
  showFilter: boolean
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
      <div className="relative flex-1">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search communities..."
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 bg-surface border border-border rounded-xl outline-none focus:ring-2 focus:ring-ring text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        {showFilter && (
          <select
            aria-label="Filter communities"
            value={filter}
            onChange={(e) => onFilter(e.target.value as PondFilter)}
            className="px-3 py-2.5 bg-surface border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All communities</option>
            <option value="owned">Owned by me</option>
            <option value="joined">Joined</option>
          </select>
        )}
        <select
          aria-label="Sort communities"
          value={sort}
          onChange={(e) => onSort(e.target.value as PondSort)}
          className="px-3 py-2.5 bg-surface border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="active">Recently active</option>
          <option value="newest">Newest</option>
          <option value="alpha">Alphabetical</option>
          <option value="members">Most members</option>
        </select>
      </div>
    </div>
  )
}
