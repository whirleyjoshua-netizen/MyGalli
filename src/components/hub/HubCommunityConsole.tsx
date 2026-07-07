'use client'
import { useEffect, useState } from 'react'
import { HubPostComposer } from './HubPostComposer'

type Member = { userId: string; username: string; name: string | null; avatar: string | null }

export function HubCommunityConsole({ hubId, initialEnabled }: { hubId: string; initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [members, setMembers] = useState<Member[]>([])
  const [posts, setPosts] = useState<{ id: string; text: string | null; createdAt: string }[]>([])

  async function refresh() {
    if (!enabled) return
    const [m, p] = await Promise.all([
      fetch(`/api/hubs/${hubId}/members`).then((r) => (r.ok ? r.json() : { members: [] })),
      fetch(`/api/hubs/${hubId}/posts`).then((r) => (r.ok ? r.json() : { posts: [] })),
    ])
    setMembers(m.members)
    setPosts(p.posts)
  }
  useEffect(() => { refresh() }, [enabled, hubId])

  async function toggle() {
    const next = !enabled
    const res = await fetch(`/api/hubs/${hubId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ community: next }),
    })
    if (res.ok) setEnabled(next)
  }
  async function removeMember(userId: string) {
    await fetch(`/api/hubs/${hubId}/members`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
    setMembers((cur) => cur.filter((x) => x.userId !== userId))
  }
  async function deletePost(id: string) {
    await fetch(`/api/hubs/${hubId}/posts/${id}`, { method: 'DELETE' })
    setPosts((cur) => cur.filter((x) => x.id !== id))
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={enabled} onChange={toggle} />
        Community Hub — let people join and follow your posts
      </label>
      {enabled && (
        <>
          <HubPostComposer hubId={hubId} onPosted={refresh} />
          <div>
            <h4 className="mb-2 text-sm font-semibold">Posts ({posts.length})</h4>
            {posts.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-border py-2 text-sm">
                <span className="truncate">{p.text || '(image)'}</span>
                <button onClick={() => deletePost(p.id)} className="text-xs text-muted-foreground hover:text-red-500">Delete</button>
              </div>
            ))}
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold">Members ({members.length})</h4>
            {members.map((m) => (
              <div key={m.userId} className="flex items-center justify-between py-1.5 text-sm">
                <span>@{m.username}</span>
                <button onClick={() => removeMember(m.userId)} className="text-xs text-muted-foreground hover:text-red-500">Remove</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
