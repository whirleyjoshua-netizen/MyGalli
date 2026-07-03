'use client'

import { useEffect, useState } from 'react'
import { Megaphone } from 'lucide-react'
import type { ElementAggregate, RespondentAnswer } from '@/lib/element-aggregate'

interface BulletinAnalyticsPost {
  id: string
  createdAt: string
  text: string | null
  results: ElementAggregate
}

function Avatar({ user }: { user: RespondentAnswer['user'] }) {
  return (
    <span title={user.name} className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
      {user.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        user.name.slice(0, 1).toUpperCase()
      )}
    </span>
  )
}

function Roster({ results }: { results: ElementAggregate }) {
  if (results.respondents.length === 0) {
    return <p className="text-sm text-muted-foreground">No responses yet.</p>
  }
  if (results.type === 'poll') {
    return (
      <div className="space-y-2">
        {results.options.map((opt) => {
          const voters = results.respondents.filter((r) => Array.isArray(r.answer) && (r.answer as string[]).includes(opt))
          const d = results.distribution.find((x) => x.option === opt)
          return (
            <div key={opt}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-foreground">{opt}</span>
                <span className="text-muted-foreground">{d?.count ?? 0} · {d?.percentage ?? 0}%</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {voters.map((r) => <Avatar key={r.user.userId} user={r.user} />)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }
  if (results.type === 'rating') {
    return (
      <div className="space-y-1.5">
        <p className="text-sm text-muted-foreground">Average {results.average} · {results.responseCount} ratings</p>
        <div className="flex flex-wrap gap-2">
          {results.respondents.map((r) => (
            <span key={r.user.userId} className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs">
              <Avatar user={r.user} /> {String(r.answer)}★
            </span>
          ))}
        </div>
      </div>
    )
  }
  // shortanswer
  return (
    <div className="space-y-2">
      {results.respondents.map((r) => (
        <div key={r.user.userId} className="flex items-start gap-2">
          <Avatar user={r.user} />
          <p className="text-sm text-foreground">{String(r.answer)}</p>
        </div>
      ))}
    </div>
  )
}

export function BulletinAnalyticsTab() {
  const [posts, setPosts] = useState<BulletinAnalyticsPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/bulletin/analytics')
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((d) => setPosts(Array.isArray(d.posts) ? d.posts : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading bulletin data…</div>
  if (posts.length === 0) {
    return (
      <div className="py-20 text-center">
        <Megaphone className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="mb-2 text-lg font-medium">No bulletin instruments yet</h2>
        <p className="text-muted-foreground">Post a poll, rating, or question on your Bulletin to see who responds.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {posts.map((p) => {
        const title = p.results.type === 'poll' ? p.results.question : p.results.type === 'rating' ? p.results.question : p.results.question
        return (
          <div key={p.id} className="rounded-lg border border-border bg-muted/30 p-6">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-medium">{title}</h3>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{p.results.type}</span>
            </div>
            {p.text && <p className="mb-4 text-sm text-muted-foreground">{p.text}</p>}
            <Roster results={p.results} />
          </div>
        )
      })}
    </div>
  )
}
