'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Users, Globe, Lock } from 'lucide-react'

interface SharedDisplay {
  id: string
  slug: string
  title: string
  coverImage?: string | null
  published: boolean
  updatedAt: string
  owner: { username: string; name: string | null; avatar: string | null }
}

type Community = {
  id: string
  title: string
  username: string
  slug: string
  coverImage: string | null
  latestPost: { text: string | null; createdAt: string } | null
}

export default function MyPondPage() {
  return (
    <Suspense fallback={<div className="px-6 lg:px-8 py-7"><p className="text-sm text-muted-foreground">Loading…</p></div>}>
      <MyPondContent />
    </Suspense>
  )
}

function MyPondContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'collabs' | 'communities'>(
    searchParams.get('tab') === 'collabs' ? 'collabs' : 'communities'
  )
  const [displays, setDisplays] = useState<SharedDisplay[]>([])
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/collaborations').then((r) => (r.ok ? r.json() : { displays: [] })).then((d) => setDisplays(Array.isArray(d?.displays) ? d.displays : [])).catch(() => {}),
      fetch('/api/communities/joined').then((r) => (r.ok ? r.json() : { communities: [] })).then((d) => setCommunities(Array.isArray(d?.communities) ? d.communities : [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  return (
    <div className="px-6 lg:px-8 py-7">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          <Users className="w-6 h-6 text-primary" /> My Pond
        </h1>
        <p className="text-muted-foreground mt-1">Communities you&apos;ve joined and pages you collaborate on.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border mb-6">
        {([['communities', 'Communities', communities.length], ['collabs', 'Collabs', displays.length]] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label} <span className="font-normal text-muted-foreground">({count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : activeTab === 'communities' ? (
        communities.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl">
            <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">You haven&apos;t joined any communities yet.</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Join a community hub and it shows up here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {communities.map((c) => (
              <a key={c.id} href={`/${c.username}/hub/${c.slug}`} className="rounded-xl border border-border bg-surface p-4 hover:shadow-soft transition">
                <div className="font-semibold">{c.title}</div>
                <div className="mt-1 text-xs text-muted-foreground truncate">{c.latestPost?.text || 'No posts yet'}</div>
              </a>
            ))}
          </div>
        )
      ) : displays.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No pages shared with you yet.</p>
          <p className="text-sm text-muted-foreground/70 mt-1">When someone invites you to collaborate, it shows up here.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displays.map((d) => (
            <button
              key={d.id}
              onClick={() => router.push(`/editor?id=${d.id}`)}
              className="group text-left rounded-2xl border border-border bg-surface overflow-hidden shadow-soft hover:shadow-soft-lg hover:border-primary/30 transition-all cursor-pointer"
            >
              <div className={`h-32 ${d.coverImage ? '' : 'bg-gradient-to-br from-galli/20 to-galli-violet/20'}`}>
                {d.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.coverImage} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{d.title}</h3>
                  {d.published ? <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">shared by @{d.owner.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
