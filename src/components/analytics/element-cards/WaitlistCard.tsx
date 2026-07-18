'use client'

import { Rocket, Download } from 'lucide-react'

interface WaitlistData {
  elementId: string
  type: 'waitlist'
  title: string
  capacity: number | null
  count: number
  signups: { email: string; name: string | null; joinedAt: string }[]
}

export function WaitlistCard({ data, displayId }: { data: WaitlistData; displayId: string }) {
  return (
    <div className="bg-background border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <Rocket className="w-4 h-4 text-primary" /> {data.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data.count.toLocaleString()} {data.count === 1 ? 'signup' : 'signups'}
            {data.capacity != null ? ` of ${data.capacity}` : ''}
          </p>
        </div>
        <a
          href={`/api/waitlist/${displayId}/${data.elementId}/export`}
          className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/70 aria-disabled:pointer-events-none aria-disabled:opacity-50"
          aria-disabled={!data.signups.length}
          download
        >
          <Download className="w-4 h-4" /> Download CSV
        </a>
      </div>

      <div className="max-h-64 overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Email</th>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {data.signups.map((s, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-3 py-2">{s.email}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.name ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{new Date(s.joinedAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {!data.signups.length && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                  No signups yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
