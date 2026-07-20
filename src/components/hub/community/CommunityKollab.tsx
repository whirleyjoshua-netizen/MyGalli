'use client'

import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { ImagePlus, Loader2, Play, X, Trash2 } from 'lucide-react'
import { dropPathPrefix, type DropDTO } from '@/lib/hub-drops'
import { consentTextFor } from '@/lib/hub-consent'

async function captureVideoPoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      let settled = false
      const finish = (result: Blob | null) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        resolve(result)
      }
      const timeout = setTimeout(() => finish(null), 3000)
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      video.src = URL.createObjectURL(file)
      video.onloadeddata = () => { video.currentTime = Math.min(0.1, video.duration || 0.1) }
      video.onseeked = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth; canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return finish(null)
        ctx.drawImage(video, 0, 0)
        canvas.toBlob((b) => finish(b), 'image/jpeg', 0.8)
      }
      video.onerror = () => finish(null)
    } catch { resolve(null) }
  })
}

export function CommunityKollab({
  hubId, hubTitle, canDrop, isPrivileged, currentUserId, enabled, requireApproval, initialDrops, total, preview, narrow,
}: {
  hubId: string
  hubTitle: string
  canDrop: boolean
  isPrivileged: boolean
  currentUserId?: string
  enabled: boolean
  requireApproval?: boolean
  initialDrops: DropDTO[]
  total: number
  preview?: boolean
  narrow?: boolean
}) {
  const [drops, setDrops] = useState<DropDTO[]>(initialDrops)
  // Tracked in state so uploads/removals don't make "Load more" vanish or linger.
  const [count, setCount] = useState(total)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<DropDTO | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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
        if (isVideo) {
          const poster = await captureVideoPoster(file)
          if (poster) {
            const pb = await upload(`${prefix}${file.name}.poster.jpg`, poster, { access: 'public', handleUploadUrl: uploadUrl })
            thumbnailUrl = pb.url
          }
        }
        const res = await fetch(`/api/hubs/${hubId}/drops`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: isVideo ? 'video' : 'image', url: blob.url, thumbnailUrl, mimeType: file.type }),
        })
        if (!res.ok) { setError((await res.json()).error || 'Upload failed'); continue }
        const { id } = await res.json()
        const pendingApproval = !!requireApproval && !isPrivileged
        if (pendingApproval) {
          setNotice('Uploaded — pending review before it appears in the pool.')
        } else {
          const me = { userId: currentUserId || '', username: 'you', name: null, avatar: null }
          setDrops((cur) => [{ id, type: isVideo ? 'video' : 'image', url: blob.url, thumbnailUrl, caption: null, mimeType: file.type, width: null, height: null, hidden: false, createdAt: new Date().toISOString(), author: me }, ...cur])
          setCount((c) => c + 1)
        }
      } catch (e) {
        setError((e as Error).message || 'Upload failed')
      } finally {
        setUploading(false)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function loadMore() {
    if (preview || loadingMore || !drops.length) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/hubs/${hubId}/drops?cursor=${encodeURIComponent(drops[drops.length - 1].id)}`)
      if (!res.ok) return
      const d = await res.json()
      const fresh: DropDTO[] = d.drops ?? []
      // Guard against a drop arriving in both pages if the pool changed mid-scroll.
      setDrops((cur) => {
        const seen = new Set(cur.map((x) => x.id))
        return [...cur, ...fresh.filter((x) => !seen.has(x.id))]
      })
      if (!d.nextCursor) setExhausted(true)
    } finally {
      setLoadingMore(false)
    }
  }

  async function remove(id: string) {
    if (preview) return
    if (!confirm('Remove this from the pool?')) return
    const res = await fetch(`/api/hubs/${hubId}/drops/${id}`, { method: 'DELETE' })
    if (res.ok) { setDrops((cur) => cur.filter((d) => d.id !== id)); setCount((c) => Math.max(0, c - 1)) }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">Kollab</h2>
          <p className="text-sm text-muted-foreground">Drop your clips &amp; photos into the community pool.</p>
        </div>
        {canDrop && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {uploading ? 'Uploading…' : 'Drop content'}
          </button>
        )}
      </div>

      {canDrop && (
        <p className="mb-3 text-xs text-muted-foreground">{consentTextFor(hubTitle)}</p>
      )}

      <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      {error && <p className="mb-3 text-xs text-destructive">{error}</p>}
      {notice && <p className="mb-3 text-xs text-primary">{notice}</p>}

      {drops.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {canDrop ? 'Be the first to drop a clip or photo.' : 'Nothing in the pool yet.'}
        </div>
      ) : (
        <div className={`grid gap-2 ${narrow ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'}`}>
          {drops.map((d) => (
            <div key={d.id} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
              <button onClick={() => setLightbox(d)} className="block h-full w-full">
                {(d.thumbnailUrl || d.type === 'image') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.thumbnailUrl || d.url} alt={d.caption || ''} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-black/80 text-xs text-white/40">Video</div>
                )}
                {d.type === 'video' && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Play className="h-8 w-8 text-white drop-shadow" fill="currentColor" />
                  </span>
                )}
              </button>
              {(isPrivileged || d.author.userId === currentUserId) && (
                <button onClick={() => remove(d.id)} title="Remove" className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!preview && !exhausted && drops.length < count && (
        <div className="mt-4 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <button className="absolute right-4 top-4 text-white" onClick={() => setLightbox(null)}><X className="h-6 w-6" /></button>
          <div className="max-h-[90vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {lightbox.type === 'video' ? (
              <video src={lightbox.url} controls autoPlay className="max-h-[80vh] w-full rounded-lg" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox.url} alt={lightbox.caption || ''} className="max-h-[80vh] w-full rounded-lg object-contain" />
            )}
            <p className="mt-2 text-center text-sm text-white/80">{lightbox.caption} <span className="text-white/50">· {lightbox.author.name || lightbox.author.username}</span></p>
          </div>
        </div>
      )}
    </section>
  )
}
