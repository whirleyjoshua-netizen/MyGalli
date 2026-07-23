'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Volume2, VolumeX } from 'lucide-react'

export type ReelClip = {
  dropId: string
  in: number
  out: number
  type: string
  url: string
  thumbnailUrl: string | null
  caption: string | null
  author: string
}

export type Reel = {
  id: string
  title: string
  status: string
  runtimeSec: number
  createdAt: string
  creator: { username: string }
  clips: ReelClip[]
}

export default function KollabReelPlayer({ reel, onClose }: { reel: Reel; onClose: () => void }) {
  const [i, setI] = useState(0)
  const [muted, setMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  // Guards against double-advancing a single clip: a video clip can fire both
  // its `timeupdate` (when currentTime reaches `out`) and `ended` listeners
  // for the same end-of-playback moment. Reset whenever the clip index
  // changes so the next clip is armed for its own single advance.
  const advancedRef = useRef(false)
  const clip = reel.clips[i]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    advancedRef.current = false
  }, [i])

  const next = useCallback(() => {
    if (advancedRef.current) return
    advancedRef.current = true
    setI((cur) => (cur + 1 < reel.clips.length ? cur + 1 : cur))
  }, [reel.clips.length])

  // A still has no timeupdate to drive it, so it advances on a timer.
  useEffect(() => {
    if (!clip || clip.type === 'video') return
    const ms = Math.max(0.5, clip.out - clip.in) * 1000
    const t = setTimeout(next, ms)
    return () => clearTimeout(t)
  }, [clip, next])

  // Seek to the clip's in-point and stop at its out-point. `out` is clamped
  // server-side where a duration is known.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !clip || clip.type !== 'video') return
    v.currentTime = clip.in
    // jsdom's HTMLMediaElement.play() was observed to return undefined
    // (neither throwing nor rejecting) rather than a real promise, and a
    // real browser can reject autoplay too — swallow both so a play
    // failure never crashes the effect.
    try {
      v.play()?.catch(() => {})
    } catch {
      // ignore
    }
    const onTime = () => { if (v.currentTime >= clip.out) next() }
    v.addEventListener('timeupdate', onTime)
    return () => v.removeEventListener('timeupdate', onTime)
  }, [clip, next])

  if (!clip) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6" role="dialog" aria-modal="true">
        <div className="text-center text-white">
          <p className="text-sm">This reel&rsquo;s clips are no longer available.</p>
          <button onClick={onClose} className="mt-4 rounded-lg border border-white/30 px-4 py-2 text-sm">Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={reel.title}>
      <div className="flex items-center justify-between p-4 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{reel.title}</p>
          <p className="text-xs text-white/60">{i + 1} / {reel.clips.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="rounded-lg p-2 hover:bg-white/10"
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {clip.type === 'video' ? (
          <video
            ref={videoRef}
            key={`${clip.dropId}-${i}`}
            src={clip.url}
            poster={clip.thumbnailUrl ?? undefined}
            muted={muted}
            playsInline
            // A dead Blob URL must not strand the reel on a black frame.
            onError={next}
            onEnded={next}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <img
            key={`${clip.dropId}-${i}`}
            src={clip.url}
            alt={clip.caption ?? ''}
            onError={next}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>

      <div className="p-4 text-white">
        {clip.caption && <p className="text-sm">{clip.caption}</p>}
        <p className="text-xs text-white/60">@{clip.author}</p>
      </div>
    </div>
  )
}
