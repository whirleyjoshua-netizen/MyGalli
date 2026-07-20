'use client'

import { useEffect, useState } from 'react'
import { Loader2, ShieldOff, Check } from 'lucide-react'

type ReportRow = {
  id: string
  targetType: 'post' | 'comment' | 'drop' | 'member'
  targetId: string
  reason: string
  note: string | null
  status: string
  createdAt: string
}

export function ModerationQueue({ hubId }: { hubId: string }) {
  const [reports, setReports] = useState<ReportRow[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () =>
    fetch(`/api/hubs/${hubId}/reports`)
      .then((r) => (r.ok ? r.json() : { reports: [] }))
      .then((d) => setReports(d.reports ?? []))
      .catch(() => setReports([]))

  useEffect(() => { load() }, [hubId])

  async function dismiss(id: string) {
    setBusyId(id)
    setError(null)
    const res = await fetch(`/api/hubs/${hubId}/reports/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'dismissed' }),
    })
    setBusyId(null)
    if (!res.ok) { setError('Could not dismiss report'); return }
    setReports((cur) => (cur ?? []).filter((r) => r.id !== id))
  }

  async function removeAndBan(report: ReportRow) {
    if (report.targetType !== 'member') return
    setBusyId(report.id)
    setError(null)
    const res = await fetch(`/api/hubs/${hubId}/bans`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: report.targetId }),
    })
    if (!res.ok) { setBusyId(null); setError('Could not ban user'); return }
    await fetch(`/api/hubs/${hubId}/reports/${report.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'actioned' }),
    })
    setBusyId(null)
    setReports((cur) => (cur ?? []).filter((r) => r.id !== report.id))
  }

  if (reports === null) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }

  return (
    <div className="max-w-2xl space-y-4">
      <section>
        <h2 className="text-lg font-bold">Moderation</h2>
        <p className="mb-3 text-sm text-muted-foreground">Open reports for this community.</p>

        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

        {reports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">No open reports.</div>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{r.targetType} · {r.reason}</p>
                    {r.note && <p className="mt-0.5 text-xs text-muted-foreground">{r.note}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => dismiss(r.id)}
                      disabled={busyId === r.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Dismiss
                    </button>
                    {r.targetType === 'member' && (
                      <button
                        onClick={() => removeAndBan(r)}
                        disabled={busyId === r.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        <ShieldOff className="h-3.5 w-3.5" /> Remove &amp; ban
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
