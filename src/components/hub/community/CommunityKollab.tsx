'use client'

import { useEffect, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { dropPathPrefix, type DropDTO } from '@/lib/hub-drops'
import { consentTextFor } from '@/lib/hub-consent'
import { KollabTile } from './KollabTile'
import { KollabViewer } from './KollabViewer'
import { KollabReelRequest } from './KollabReelRequest'
import KollabReelPlayer, { type Reel } from './KollabReelPlayer'

function captureVideoPoster(file: File): Promise<{ blob: Blob | null; duration: number | null }> {
  return new Promise((resolve) => {
    try {
      let done = false
      const finish = (blob: Blob | null, duration: number | null) => {
        if (done) return
        done = true
        clearTimeout(timeout)
        resolve({ blob, duration })
      }
      const video = document.createElement('video')
      const dur = () => (Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null)
      // Some codecs never fire loadeddata/seeked. Without this the promise never
      // settles and the upload stalls with no error — restore before removing.
      const timeout = setTimeout(() => finish(null, dur()), 3000)
      video.preload = 'metadata'
      video.muted = true
      video.src = URL.createObjectURL(file)
      video.onloadeddata = () => { video.currentTime = Math.min(0.1, video.duration || 0.1) }
      video.onseeked = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth; canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return finish(null, dur())
        ctx.drawImage(video, 0, 0)
        canvas.toBlob((b) => finish(b, dur()), 'image/jpeg', 0.8)
      }
      video.onerror = () => finish(null, null)
    } catch { resolve({ blob: null, duration: null }) }
  })
}

export function CommunityKollab({
  hubId, hubTitle, canDrop, canStitch = false, isPrivileged, currentUserId, enabled, initialDrops, total, pendingCount, preview,
}: {
  hubId: string
  hubTitle: string
  canDrop: boolean
  canStitch?: boolean
  isPrivileged: boolean
  currentUserId?: string
  enabled: boolean
  initialDrops: DropDTO[]
  total: number
  pendingCount: number
  preview?: boolean
  /** Retained for call-site compatibility; the tile is the same at any width. */
  narrow?: boolean
}) {
  const [drops, setDrops] = useState<DropDTO[]>(initialDrops)
  const [count, setCount] = useState(total)
  const [pending, setPending] = useState(pendingCount)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [reels, setReels] = useState<Reel[]>([])
  const [requesting, setRequesting] = useState(false)
  const [reelBusy, setReelBusy] = useState(false)
  const [reelError, setReelError] = useState<string | null>(null)
  const [playing, setPlaying] = useState<Reel | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (preview) return
    fetch(`/api/hubs/${hubId}/kollab/reels`)
      .then((r) => (r.ok ? r.json() : { reels: [] }))
      .then((d) => setReels(d.reels ?? []))
      .catch(() => {})
  }, [hubId, preview])

  async function createReel(v: { preset: string; prompt: string | null; targetSec: number }) {
    setReelBusy(true)
    setReelError(null)
    try {
      const res = await fetch(`/api/hubs/${hubId}/kollab/reels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setReelError(body.error || 'Could not build that reel.'); return }
      setReels((cur) => [body, ...cur])
      setRequesting(false)
      setPlaying(body)
    } finally {
      setReelBusy(false)
    }
  }

  async function publishReel(id: string, action: 'publish' | 'unpublish') {
    const nextStatus = action === 'publish' ? 'published' : 'draft'
    const prev = reels
    setReels((cur) => cur.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)))
    const res = await fetch(`/api/hubs/${hubId}/kollab/reels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (!res.ok) setReels(prev)
  }

  if (!enabled) return null

  const uploadUrl = `/api/hubs/${hubId}/drops/upload`

  async function handleFiles(files: FileList | null) {
    if (!files || preview) return
    setError(null)
    setNotice(null)
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith('video/')
      const isImage = file.type.startsWith('image/')
      if (!isVideo && !isImage) { setError('Only photos and video are allowed'); continue }
      setUploading(true)
      try {
        // Must sit under this hub's namespace — the token route refuses anything else.
        const prefix = dropPathPrefix(hubId)
        const blob = await upload(`${prefix}${file.name}`, file, { access: 'public', handleUploadUrl: uploadUrl })
        let thumbnailUrl: string | null = null
        let durationSec: number | null = null
        if (isVideo) {
          const { blob: poster, duration } = await captureVideoPoster(file)
          durationSec = duration
          if (poster) {
            const pb = await upload(`${prefix}${file.name}.poster.jpg`, poster, { access: 'public', handleUploadUrl: uploadUrl })
            thumbnailUrl = pb.url
          }
        }
        const res = await fetch(`/api/hubs/${hubId}/drops`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: isVideo ? 'video' : 'image', url: blob.url, thumbnailUrl, mimeType: file.type, durationSec }),
        })
        if (!res.ok) { setError((await res.json()).error || 'Upload failed'); continue }
        // The server decides the status — never assume from the client's own
        // idea of who is privileged.
        const { id, status } = await res.json()
        if (status === 'approved') {
          const me = { userId: currentUserId || '', username: 'you', name: null, avatar: null }
          setDrops((cur) => [{ id, type: isVideo ? 'video' : 'image', url: blob.url, thumbnailUrl, caption: null, mimeType: file.type, width: null, height: null, status: 'approved', createdAt: new Date().toISOString(), author: me }, ...cur])
          setCount((c) => c + 1)
        } else {
          setNotice('Uploaded — the owner will review it before it appears.')
          if (isPrivileged) setPending((p) => p + 1)
        }
      } catch (e) {
        setError((e as Error).message || 'Upload failed')
      } finally {
        setUploading(false)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <KollabTile
        count={count}
        pendingCount={pending}
        canDrop={canDrop}
        canStitch={canStitch}
        isPrivileged={isPrivileged}
        uploading={uploading}
        onDrop={() => fileRef.current?.click()}
        onSee={() => setViewerOpen(true)}
        onMakeReel={() => setRequesting(true)}
      />

      <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      {canDrop && <p className="mt-2 text-center text-[11px] text-muted-foreground">{consentTextFor(hubTitle)}</p>}
      {error && <p className="mt-2 text-center text-xs text-destructive">{error}</p>}
      {notice && <p className="mt-2 text-center text-xs text-[#FF6B3D]">{notice}</p>}

      {viewerOpen && !preview && (
        <KollabViewer
          hubId={hubId}
          isPrivileged={isPrivileged}
          currentUserId={currentUserId}
          initialDrops={drops}
          total={count}
          pendingCount={pending}
          initialTab={count === 0 && pending > 0 && isPrivileged ? 'pending' : 'approved'}
          onClose={() => setViewerOpen(false)}
          onApprovedCountChange={(d) => setCount((c) => Math.max(0, c + d))}
          onPendingCountChange={(d) => setPending((p) => Math.max(0, p + d))}
          reels={reels}
          onPublish={publishReel}
          onPlay={setPlaying}
        />
      )}

      {requesting && !preview && (
        <KollabReelRequest
          onSubmit={createReel}
          onClose={() => { setRequesting(false); setReelError(null) }}
          busy={reelBusy}
          error={reelError}
        />
      )}
      {playing && <KollabReelPlayer reel={playing} onClose={() => setPlaying(null)} />}
    </>
  )
}
