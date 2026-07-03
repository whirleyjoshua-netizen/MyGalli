'use client'

import { Users, UserCheck, HelpCircle, UserX, ClipboardList, StickyNote, Globe, Lock } from 'lucide-react'

interface RSVPData {
  elementId: string
  type: 'rsvp'
  subject: string
  public: boolean
  responseCount: number
  going: number
  maybe: number
  cant: number
  totalGuests: number
  itemBoard: { label: string; claimedBy: string[]; claimed: boolean }[]
  notes: { name: string; note: string }[]
  guests: { name: string; attending: 'going' | 'maybe' | 'cant'; guests: number; items: string[]; note?: string; submittedAt: string }[]
  tabLabel?: string
}

const STATUS_LABEL: Record<RSVPData['guests'][number]['attending'], string> = {
  going: 'Going',
  maybe: 'Maybe',
  cant: "Can't go",
}
const STATUS_CLASS: Record<RSVPData['guests'][number]['attending'], string> = {
  going: 'bg-green-100 text-green-700',
  maybe: 'bg-amber-100 text-amber-700',
  cant: 'bg-red-100 text-red-700',
}

export function RSVPCard({ data }: { data: RSVPData }) {
  return (
    <div className="bg-background border border-border rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{data.subject}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {data.public ? <><Globe className="w-3 h-3" /> Public board</> : <><Lock className="w-3 h-3" /> Private</>}
            </span>
            {data.tabLabel && <span className="text-xs text-muted-foreground">· Tab: {data.tabLabel}</span>}
          </div>
        </div>
        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {data.responseCount} {data.responseCount === 1 ? 'response' : 'responses'}
        </span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <UserCheck className="w-5 h-5 text-green-600 mx-auto mb-1" />
          <div className="text-2xl font-bold text-green-700">{data.going}</div>
          <div className="text-xs text-green-600">Going</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 text-center">
          <HelpCircle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
          <div className="text-2xl font-bold text-amber-700">{data.maybe}</div>
          <div className="text-xs text-amber-600">Maybe</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <UserX className="w-5 h-5 text-red-500 mx-auto mb-1" />
          <div className="text-2xl font-bold text-red-600">{data.cant}</div>
          <div className="text-xs text-red-500">Can&apos;t go</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <Users className="w-5 h-5 text-blue-600 mx-auto mb-1" />
          <div className="text-2xl font-bold text-blue-700">{data.totalGuests}</div>
          <div className="text-xs text-blue-600">Total heads</div>
        </div>
      </div>

      {/* Item board */}
      {data.itemBoard.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Bring list</span>
          </div>
          <div className="space-y-1">
            {data.itemBoard.map((it) => (
              <div key={it.label} className="flex items-center justify-between text-sm bg-muted/40 rounded px-3 py-1.5">
                <span className={it.claimed ? 'text-foreground' : 'text-muted-foreground'}>{it.label}</span>
                <span className={`text-xs ${it.claimed ? 'text-foreground' : 'text-muted-foreground/70 italic'}`}>
                  {it.claimed ? it.claimedBy.join(', ') : 'open'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {data.notes.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <StickyNote className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Notes</span>
          </div>
          <div className="space-y-1">
            {data.notes.map((n, i) => (
              <div key={i} className="text-sm text-muted-foreground bg-muted/50 rounded px-3 py-1.5">
                <span className="font-medium text-foreground">{n.name}:</span> {n.note}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guest list */}
      {data.guests.length > 0 && (
        <div>
          <span className="text-sm font-medium text-foreground">Guest list</span>
          <div className="mt-2 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">+1s</th>
                  <th className="px-3 py-2 text-left font-medium">Bringing</th>
                </tr>
              </thead>
              <tbody>
                {data.guests.map((g, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">{g.name}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[g.attending]}`}>
                        {STATUS_LABEL[g.attending]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{g.guests || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{g.items.length ? g.items.join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
