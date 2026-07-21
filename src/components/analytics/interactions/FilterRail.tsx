'use client'

import { Search } from 'lucide-react'
import { TYPE_GROUPS, type ElementFilter, type ElementStatus, type SortMode } from '@/lib/element-os'

const STATUSES: { id: ElementStatus; label: string; dot: string }[] = [
  { id: 'needs-attention', label: 'Need Attention', dot: 'bg-amber-500' },
  { id: 'live', label: 'Live Now', dot: 'bg-galli' },
  { id: 'draft', label: 'Draft', dot: 'bg-muted-foreground' },
  { id: 'idle', label: 'Idle', dot: 'bg-border' },
]

const SORTS: { id: SortMode; label: string }[] = [
  { id: 'most-active', label: 'Most active' },
  { id: 'least-active', label: 'Least active' },
  { id: 'recent', label: 'Recent activity' },
  { id: 'stale', label: 'Longest idle' },
]

const SOURCES: { id: ElementFilter['source']; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'page', label: 'Pages' },
  { id: 'bulletin', label: 'Bulletin' },
]

export function FilterRail({
  filter,
  sort,
  statusCounts,
  onChange,
  onSortChange,
  onReset,
}: {
  filter: ElementFilter
  sort: SortMode
  statusCounts: Record<ElementStatus, number>
  onChange: (next: ElementFilter) => void
  onSortChange: (next: SortMode) => void
  onReset: () => void
}) {
  // A chip represents a display group, which can cover more than one element
  // type (a "Polls" chip selects poll + mcq).
  const groupActive = (types: string[]) => types.every((t) => filter.types.includes(t as never))
  const toggleGroup = (types: string[]) => {
    const next = groupActive(types)
      ? filter.types.filter((t) => !types.includes(t))
      : [...filter.types, ...types.filter((t) => !filter.types.includes(t as never))]
    onChange({ ...filter, types: next as ElementFilter['types'] })
  }

  const toggleStatus = (id: ElementStatus) => {
    const next = filter.statuses.includes(id)
      ? filter.statuses.filter((s) => s !== id)
      : [...filter.statuses, id]
    onChange({ ...filter, statuses: next })
  }

  return (
    <aside className="space-y-5 rounded-2xl border border-border bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Filter Elements</h2>
        <button onClick={onReset} className="text-xs font-medium text-galli-dark hover:underline">
          Reset
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={filter.search}
          onChange={(e) => onChange({ ...filter, search: e.target.value })}
          placeholder="Search elements..."
          className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-sm"
        />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Type</p>
        <div className="flex flex-wrap gap-2">
          {TYPE_GROUPS.map((g) => (
            <button
              key={g.label}
              onClick={() => toggleGroup(g.types)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                groupActive(g.types)
                  ? 'border-galli bg-galli/10 text-galli-dark'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
        <div className="space-y-1.5">
          {STATUSES.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filter.statuses.includes(s.id)}
                onChange={() => toggleStatus(s.id)}
                className="rounded border-border"
              />
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
              <span className="flex-1">{s.label}</span>
              <span className="text-xs text-muted-foreground">{statusCounts[s.id] ?? 0}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Source</p>
        <div className="flex gap-2">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              onClick={() => onChange({ ...filter, source: s.id })}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                filter.source === s.id
                  ? 'border-galli bg-galli/10 text-galli-dark'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="element-sort" className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sort by
        </label>
        <select
          id="element-sort"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortMode)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </aside>
  )
}
