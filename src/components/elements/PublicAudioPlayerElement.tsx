'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, Music } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { spotifyEmbedUrl, soundcloudEmbedUrl } from '@/lib/audio-embed'

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function Placeholder() {
  return (
    <div className="flex items-center gap-2 p-4 rounded-xl border border-dashed border-border text-sm text-muted-foreground">
      <Music className="w-4 h-4" /> Add a track to play.
    </div>
  )
}

export function PublicAudioPlayerElement({ element }: { element: CanvasElement }) {
  const type = element.audioSourceType || 'file'

  if (type === 'spotify') {
    const src = element.audioUrl ? spotifyEmbedUrl(element.audioUrl) : null
    return src ? (
      <iframe title="Spotify player" src={src} className="w-full rounded-xl border-0" height={152} allow="encrypted-media" loading="lazy" />
    ) : <Placeholder />
  }
  if (type === 'soundcloud') {
    const src = element.audioUrl ? soundcloudEmbedUrl(element.audioUrl) : null
    return src ? (
      <iframe title="SoundCloud player" src={src} className="w-full rounded-xl border-0" height={166} allow="autoplay" loading="lazy" />
    ) : <Placeholder />
  }
  return <FilePlayer element={element} />
}

function FilePlayer({ element }: { element: CanvasElement }) {
  const url = element.audioUrl
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)

  // Auto-start: attempt play on mount; if blocked, start on first page interaction.
  useEffect(() => {
    const a = ref.current
    if (!a || !url || !element.audioAutoStart) return
    let removed = false
    const events: (keyof DocumentEventMap)[] = ['click', 'touchstart', 'keydown', 'scroll']
    const onInteract = () => { Promise.resolve(a.play()).catch(() => {}); teardown() }
    const teardown = () => {
      if (removed) return
      removed = true
      events.forEach((e) => document.removeEventListener(e, onInteract))
    }
    Promise.resolve(a.play()).catch(() => {
      events.forEach((e) => document.addEventListener(e, onInteract, { once: true, passive: true } as AddEventListenerOptions))
    })
    return teardown
  }, [url, element.audioAutoStart])

  if (!url) return <Placeholder />

  const toggle = () => {
    const a = ref.current
    if (!a) return
    if (a.paused) Promise.resolve(a.play()).catch(() => {})
    else a.pause()
  }
  const toggleMute = () => {
    const a = ref.current
    if (!a) return
    a.muted = !a.muted
    setMuted(a.muted)
  }
  const seek = (v: number) => {
    const a = ref.current
    if (a) a.currentTime = v
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-surface max-w-md">
      {element.audioCoverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={element.audioCoverUrl} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
      ) : (
        <span className="w-14 h-14 rounded-xl bg-gradient-to-br from-galli/30 to-galli-violet/30 flex items-center justify-center shrink-0">
          <Music className="w-5 h-5 text-galli-dark" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {(element.audioTitle || element.audioArtist) && (
          <div className="mb-1 min-w-0">
            <p className="text-sm font-semibold truncate">{element.audioTitle || 'Untitled'}</p>
            {element.audioArtist && <p className="text-xs text-muted-foreground truncate">{element.audioArtist}</p>}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:opacity-90 transition">
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <input type="range" min={0} max={dur || 0} value={cur} step={0.1} onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek" className="flex-1 accent-[color:var(--primary)] cursor-pointer" />
          <span className="text-[10px] tabular-nums text-muted-foreground w-16 text-right shrink-0">{fmt(cur)} / {fmt(dur)}</span>
          <button onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} className="text-muted-foreground hover:text-foreground shrink-0">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <audio
        ref={ref}
        src={url}
        loop={!!element.audioLoop}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        preload="metadata"
      />
    </div>
  )
}
