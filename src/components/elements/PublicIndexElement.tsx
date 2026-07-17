'use client'

import { useMemo, useState } from 'react'
import { Search, ChevronRight, ChevronLeft, List as ListIcon, LayoutGrid, ExternalLink } from 'lucide-react'
import type { CanvasElement, IndexEntry } from '@/lib/types/canvas'
import { filterEntries, groupByCategory, displayNumber } from '@/lib/index-element'
import { safeHref } from '@/lib/editor/safe-href'

interface Props {
  element: CanvasElement
}

function hasDetail(e: IndexEntry): boolean {
  return Boolean(e.note || (e.meta && e.meta.length) || (e.tags && e.tags.length) || e.image)
}

export function PublicIndexElement({ element }: Props) {
  const accent = element.indexAccent || '#39D98A'
  const numbers = element.indexEnableNumbers ?? true
  const showSearch = element.indexEnableSearch ?? true
  const allEntries = useMemo(() => element.indexEntries ?? [], [element.indexEntries])

  const [view, setView] = useState<'list' | 'cards'>(element.indexView ?? 'list')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [cardIndex, setCardIndex] = useState(0)

  const filtered = useMemo(() => filterEntries(allEntries, query), [allEntries, query])

  const indexById = useMemo(
    () => new Map(filtered.map((e, i) => [e.id, i])),
    [filtered],
  )

  if (allEntries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
        No entries yet.
      </div>
    )
  }

  const clampedIndex = Math.min(cardIndex, Math.max(0, filtered.length - 1))
  const groups = groupByCategory(filtered)

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          {element.indexIcon && <span className="text-lg leading-none">{element.indexIcon}</span>}
          <h3 className="text-sm font-semibold text-slate-800">{element.indexTitle || 'Index'}</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {allEntries.length}
          </span>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-slate-200">
          <button
            onClick={() => setView('list')}
            className={`p-1.5 ${view === 'list' ? 'text-white' : 'text-slate-400 hover:text-slate-600'}`}
            style={view === 'list' ? { backgroundColor: accent } : undefined}
            aria-label="List view"
          >
            <ListIcon size={15} />
          </button>
          <button
            onClick={() => setView('cards')}
            className={`p-1.5 ${view === 'cards' ? 'text-white' : 'text-slate-400 hover:text-slate-600'}`}
            style={view === 'cards' ? { backgroundColor: accent } : undefined}
            aria-label="Cards view"
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="border-b border-slate-100 px-4 py-2">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
            <Search size={14} className="text-slate-400" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setCardIndex(0) }}
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Search…"
            />
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-400">No matches.</div>
      ) : view === 'list' ? (
        /* LIST VIEW */
        <div>
          {groups.map((group) => (
            <div key={group.category || '__ungrouped__'}>
              {group.category && (
                <div className="bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {group.category}
                </div>
              )}
              {group.entries.map((entry) => {
                const globalIndex = indexById.get(entry.id) ?? 0
                const href = safeHref(entry.linkUrl)
                const detail = hasDetail(entry)
                const open = expanded === entry.id
                return (
                  <div key={entry.id} className="border-b border-slate-50 last:border-b-0">
                    <div
                      className={`flex items-center gap-3 px-4 py-2.5 ${detail ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                      onClick={detail ? () => setExpanded(open ? null : entry.id) : undefined}
                    >
                      {numbers && (
                        <span className="shrink-0 font-mono text-xs text-slate-300">
                          {displayNumber(globalIndex)}
                        </span>
                      )}
                      {entry.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.image} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-800">{entry.label}</div>
                        {entry.subtitle && <div className="truncate text-xs text-slate-400">{entry.subtitle}</div>}
                      </div>
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 text-slate-300 hover:text-slate-600"
                          style={{ color: accent }}
                          aria-label="Open link"
                        >
                          <ChevronRight size={16} />
                        </a>
                      )}
                    </div>
                    {open && detail && (
                      <div className="space-y-2 bg-slate-50 px-4 pb-3 pl-11 text-xs text-slate-600">
                        {entry.note && <p>{entry.note}</p>}
                        {entry.meta && entry.meta.length > 0 && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {entry.meta.map((m, i) => (
                              <span key={i}>
                                <span className="text-slate-400">{m.key}:</span> {m.value}
                              </span>
                            ))}
                          </div>
                        )}
                        {entry.tags && entry.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {entry.tags.map((t) => (
                              <span key={t} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="p-4">
          {(() => {
            const entry = filtered[clampedIndex]
            const href = safeHref(entry.linkUrl)
            return (
              <div className="rounded-xl border border-slate-200 p-4" style={{ borderTopColor: accent, borderTopWidth: 3 }}>
                <div className="mb-2 flex items-center gap-2">
                  {numbers && <span className="font-mono text-xs text-slate-300">{displayNumber(clampedIndex)}</span>}
                  {entry.category && <span className="text-xs font-semibold uppercase text-slate-400">{entry.category}</span>}
                </div>
                {entry.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.image} alt="" className="mb-3 h-32 w-full rounded-lg object-cover" />
                )}
                <div className="text-lg font-semibold text-slate-800">{entry.label}</div>
                {entry.subtitle && <div className="text-sm text-slate-400">{entry.subtitle}</div>}
                {entry.note && <p className="mt-2 text-sm text-slate-600">{entry.note}</p>}
                {entry.meta && entry.meta.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    {entry.meta.map((m, i) => (
                      <span key={i}><span className="text-slate-400">{m.key}:</span> {m.value}</span>
                    ))}
                  </div>
                )}
                {entry.tags && entry.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {entry.tags.map((t) => (
                      <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">#{t}</span>
                    ))}
                  </div>
                )}
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                    style={{ backgroundColor: accent }}
                  >
                    Open <ExternalLink size={14} />
                  </a>
                )}
              </div>
            )
          })()}

          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => setCardIndex((i) => Math.max(0, i - 1))}
              disabled={clampedIndex === 0}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40"
            >
              <ChevronLeft size={15} /> Prev
            </button>
            <span className="text-xs text-slate-400">
              {clampedIndex + 1} / {filtered.length}
            </span>
            <button
              onClick={() => setCardIndex((i) => Math.min(filtered.length - 1, i + 1))}
              disabled={clampedIndex >= filtered.length - 1}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
