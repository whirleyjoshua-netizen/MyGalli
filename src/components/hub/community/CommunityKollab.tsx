'use client'

import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { dropPathPrefix, type DropDTO } from '@/lib/hub-drops'
import { consentTextFor } from '@/lib/hub-consent'
import { KollabTile } from './KollabTile'
import { KollabViewer } from './KollabViewer'

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
  hubId, hubTitle, canDrop, isPrivileged, currentUserId, enabled, initialDrops, total, pendingCount, preview,
}: {
  hubId: string
  hubTitle: string
  canDrop: boolean
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
        isPrivileged={isPrivileged}
        uploading={uploading}
        onDrop={() => fileRef.current?.click()}
        onSee={() => setViewerOpen(true)}
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
          onClose={() => setViewerOpen(false)}
          onApprovedCountChange={(d) => setCount((c) => Math.max(0, c + d))}
          onPendingCountChange={(d) => setPending((p) => Math.max(0, p + d))}
        />
      )}
    </>
  )
}
