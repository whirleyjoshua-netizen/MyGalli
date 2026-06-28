'use client'

import { useState } from 'react'
import { UserPlus, UserCheck, Users } from 'lucide-react'

export function FollowButton({
  username,
  initialIsFollowing,
  initialIsFriend = false,
  size = 'md',
}: {
  username: string
  initialIsFollowing: boolean
  initialIsFriend?: boolean
  size?: 'sm' | 'md'
}) {
  const [following, setFollowing] = useState(initialIsFollowing)
  const [busy, setBusy] = useState(false)
  const [hover, setHover] = useState(false)

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    const next = !following
    setFollowing(next)
    try {
      const res = await fetch(`/api/users/${username}/follow`, { method: next ? 'POST' : 'DELETE' })
      if (!res.ok) setFollowing(!next)
    } catch {
      setFollowing(!next)
    } finally {
      setBusy(false)
    }
  }

  const pad = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'
  const isFriend = following && initialIsFriend

  if (!following) {
    return (
      <button onClick={toggle} disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${pad} bg-primary text-primary-foreground shadow-soft hover:brightness-105 transition-all disabled:opacity-50 cursor-pointer`}>
        <UserPlus className="w-4 h-4" /> Follow
      </button>
    )
  }
  return (
    <button onClick={toggle} disabled={busy} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${pad} border border-border bg-surface text-foreground hover:bg-muted transition-all disabled:opacity-50 cursor-pointer`}>
      {hover ? (
        <>Unfollow</>
      ) : isFriend ? (
        <><Users className="w-4 h-4 text-primary" /> Friends</>
      ) : (
        <><UserCheck className="w-4 h-4 text-primary" /> Following</>
      )}
    </button>
  )
}
