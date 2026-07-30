'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CrmStage } from '@prisma/client'
import { Calendar, FileText, ListPlus, Download, MessageSquare, StickyNote } from 'lucide-react'
import { timeAgo } from '@/lib/time-ago'
import type { CrmContactWithActivity } from './CrmContactCard'

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  booking: Calendar,
  form: FileText,
  waitlist: ListPlus,
  'lead-capture': Download,
  comment: MessageSquare,
  note: StickyNote,
}

function SourceIcon({ source, className }: { source: string; className?: string }) {
  const Cmp = SOURCE_ICONS[source] || StickyNote
  return <Cmp className={className} />
}

export function CrmList({
  contacts: initialContacts,
  stages,
  onSelect,
}: {
  contacts: CrmContactWithActivity[]
  stages: CrmStage[]
  onSelect?: (contact: CrmContactWithActivity) => void
}) {
  const [contacts, setContacts] = useState(initialContacts)
  const [search, setSearch] = useState('')
  const [stageId, setStageId] = useState('')
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const run = () => {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (stageId) params.set('stageId', stageId)
      setLoading(true)
      fetch(`/api/crm/contacts?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : { contacts: [] }))
        .then((data) => setContacts(Array.isArray(data.contacts) ? data.contacts : []))
        .catch(() => setContacts([]))
        .finally(() => setLoading(false))
    }
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(run, search.trim() ? 300 : 0)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [search, stageId])

  const sorted = useMemo(() => {
    const lastActivityAt = (c: CrmContactWithActivity) =>
      c.activities[0] ? new Date(c.activities[0].occurredAt).getTime() : 0
    return [...contacts].sort((a, b) => lastActivityAt(b) - lastActivityAt(a))
  }, [contacts])

  const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? 'Unknown'

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          aria-label="Search contacts"
          className="min-w-[200px] flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm"
        />
        <select
          value={stageId}
          onChange={(e) => setStageId(e.target.value)}
          aria-label="Filter by stage"
          className="rounded-full border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All stages</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-4 py-2 font-semibold">Email</th>
              <th className="px-4 py-2 font-semibold">Stage</th>
              <th className="px-4 py-2 font-semibold">Last source</th>
              <th className="px-4 py-2 font-semibold">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {loading ? 'Loading…' : 'No contacts found.'}
                </td>
              </tr>
            ) : (
              sorted.map((contact) => {
                const latest = contact.activities[0]
                return (
                  <tr
                    key={contact.id}
                    onClick={() => onSelect?.(contact)}
                    className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-2 font-medium text-foreground">{contact.name || 'Unnamed contact'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{contact.email || '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{stageName(contact.stageId)}</td>
                    <td className="px-4 py-2">
                      {latest ? (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground" title={latest.source}>
                          <SourceIcon source={latest.source} className="h-3.5 w-3.5" />
                          {latest.source}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {latest ? `${timeAgo(new Date(latest.occurredAt).toISOString())} ago` : '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
