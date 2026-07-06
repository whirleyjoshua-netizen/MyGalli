# Music Player element (`audio-player`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `audio-player` element — upload/URL (custom HTML5 player with optional auto-start) or Spotify/SoundCloud embeds — plus the upload + CSP changes it needs.

**Architecture:** A new element type rendered by a client Public component (custom `<audio>` player for direct files, provider `<iframe>` for embeds). Direct-file playback supports "auto-start" via an attempt-then-first-interaction pattern. Backed by an extended `/api/upload` (audio MIME + 25MB) and CSP `media-src`/`frame-src` additions.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, lucide-react, Vercel Blob, Vitest + Testing Library.

## Global Constraints

- Slash-menu `category` must be one of the existing `CATEGORY_ORDER` — this uses `'Media'`.
- Editor component props `{ element, onChange, onDelete, isSelected, onSelect }`; Public props `{ element }`.
- Element defaults live ONCE in `createElement()` (canvas.ts) — do NOT edit `PageEditor` (its `default:` fallback handles new types).
- Audio upload: allowed MIME `audio/mpeg, audio/mp4, audio/x-m4a, audio/aac, audio/ogg, audio/wav, audio/webm`; audio size cap **25MB**; images stay **10MB**.
- CSP additions (next.config.js): `media-src 'self' blob: https:` and `frame-src` gains `https://open.spotify.com https://w.soundcloud.com`.
- Provider links are only ever turned into iframe `src` via the pure converters (fixed `open.spotify.com`/`w.soundcloud.com` origins); a non-matching URL yields `null` → placeholder.
- `HTMLMediaElement.play()` may return `undefined` in jsdom — always wrap as `Promise.resolve(el.play()).catch(...)`.
- **Gate each task:** `npx tsc --noEmit` (exit 0) AND `npx vitest run` (full suite green). Windows + Git Bash; FOREGROUND; do NOT run `pnpm build`. Suite can be slow with transient timeouts on UNRELATED files — re-run a timed-out file; env flakiness ≠ failure.
- `git add` only the specific files per task; never `-A`. Never stage `Documents/`, `Images/`, `g1t.json`, `nul`, `test-output.txt`, `.claude/settings.local.json`.

---

## Task 1: Upload audio support + CSP

**Files:**
- Create: `src/lib/upload-validate.ts`
- Test: `src/lib/upload-validate.test.ts`
- Modify: `src/app/api/upload/route.ts`
- Modify: `next.config.js`

**Interfaces:**
- Produces: `validateUpload(type: string, size: number): { ok: true } | { ok: false; error: string }`; `extensionForMime(mime: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/upload-validate.test.ts
import { describe, it, expect } from 'vitest'
import { validateUpload, extensionForMime } from './upload-validate'

describe('validateUpload', () => {
  it('accepts an image up to 10MB', () => {
    expect(validateUpload('image/png', 9 * 1024 * 1024)).toEqual({ ok: true })
  })
  it('rejects an image over 10MB', () => {
    const r = validateUpload('image/png', 11 * 1024 * 1024)
    expect(r.ok).toBe(false)
  })
  it('accepts an audio file up to 25MB', () => {
    expect(validateUpload('audio/mpeg', 20 * 1024 * 1024)).toEqual({ ok: true })
  })
  it('rejects an audio file over 25MB', () => {
    expect(validateUpload('audio/mpeg', 26 * 1024 * 1024).ok).toBe(false)
  })
  it('rejects a disallowed type', () => {
    expect(validateUpload('application/pdf', 100).ok).toBe(false)
  })
})

describe('extensionForMime', () => {
  it('maps audio + image mimes', () => {
    expect(extensionForMime('audio/mpeg')).toBe('.mp3')
    expect(extensionForMime('image/png')).toBe('.png')
    expect(extensionForMime('application/unknown')).toBe('')
  })
})
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/lib/upload-validate.test.ts`

- [ ] **Step 3: Implement `src/lib/upload-validate.ts`**

```ts
// src/lib/upload-validate.ts
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm']
const MAX_IMAGE = 10 * 1024 * 1024
const MAX_AUDIO = 25 * 1024 * 1024

const EXT: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
  'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac',
  'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/webm': '.weba',
}

export function extensionForMime(mime: string): string {
  return EXT[mime] || ''
}

export function validateUpload(type: string, size: number): { ok: true } | { ok: false; error: string } {
  const isImage = IMAGE_TYPES.includes(type)
  const isAudio = AUDIO_TYPES.includes(type)
  if (!isImage && !isAudio) {
    return { ok: false, error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, or audio (MP3, M4A, AAC, OGG, WAV).' }
  }
  const max = isAudio ? MAX_AUDIO : MAX_IMAGE
  if (size > max) {
    return { ok: false, error: `File too large. Maximum size is ${Math.round(max / 1024 / 1024)}MB` }
  }
  return { ok: true }
}
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/lib/upload-validate.test.ts`

- [ ] **Step 5: Wire the validator into the upload route**

In `src/app/api/upload/route.ts`: add `import { validateUpload, extensionForMime } from '@/lib/upload-validate'`. Replace the two validation blocks (the `ALLOWED_TYPES.includes` check at lines 28-34 and the `file.size > MAX_FILE_SIZE` check at lines 36-42) with:

```ts
    const check = validateUpload(file.type, file.size)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }
```

Delete the now-unused `MAX_FILE_SIZE` and `ALLOWED_TYPES` consts (lines 9-10). Replace both `path.extname(file.name) || getExtensionFromMime(file.type)` usages (lines 48, 70) with `path.extname(file.name) || extensionForMime(file.type)`, and delete the local `getExtensionFromMime` function (lines 90-98). Run `npx tsc --noEmit` and remove any leftover unused symbol it flags.

- [ ] **Step 6: Extend the CSP in `next.config.js`**

In the `csp` array (`next.config.js` lines 3-15): after the `img-src` line, add a `media-src` entry, and extend `frame-src`:

```js
  "media-src 'self' blob: https:",
```

and change the `frame-src` line to:

```js
  "frame-src 'self' https://accounts.google.com https://open.spotify.com https://w.soundcloud.com",
```

- [ ] **Step 7: Gate + commit**

Run: `npx tsc --noEmit`; `npx vitest run`.

```bash
git add src/lib/upload-validate.ts src/lib/upload-validate.test.ts src/app/api/upload/route.ts next.config.js
git commit -m "feat(upload): accept audio (25MB) via shared validator; CSP media-src + spotify/soundcloud frame-src"
```

---

## Task 2: Provider embed converters

**Files:**
- Create: `src/lib/audio-embed.ts`
- Test: `src/lib/audio-embed.test.ts`

**Interfaces:**
- Produces: `spotifyEmbedUrl(shareUrl: string): string | null`; `soundcloudEmbedUrl(trackUrl: string): string | null`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/audio-embed.test.ts
import { describe, it, expect } from 'vitest'
import { spotifyEmbedUrl, soundcloudEmbedUrl } from './audio-embed'

describe('spotifyEmbedUrl', () => {
  it('converts a track share link (stripping query) to the embed url', () => {
    expect(spotifyEmbedUrl('https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6?si=abc')).toBe('https://open.spotify.com/embed/track/6rqhFgbbKwnb9MLmUQDhG6')
  })
  it('handles album/playlist and locale-prefixed paths', () => {
    expect(spotifyEmbedUrl('https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3')).toBe('https://open.spotify.com/embed/album/1DFixLWuPkv3KT3TnV35m3')
    expect(spotifyEmbedUrl('https://open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M')
  })
  it('returns null for non-spotify or malformed input', () => {
    expect(spotifyEmbedUrl('https://example.com/track/x')).toBeNull()
    expect(spotifyEmbedUrl('not a url')).toBeNull()
  })
})

describe('soundcloudEmbedUrl', () => {
  it('wraps a soundcloud track url in the player embed', () => {
    const out = soundcloudEmbedUrl('https://soundcloud.com/artist/track-name')
    expect(out).toContain('https://w.soundcloud.com/player/?url=')
    expect(out).toContain(encodeURIComponent('https://soundcloud.com/artist/track-name'))
    expect(out).toContain('auto_play=false')
  })
  it('returns null for non-soundcloud input', () => {
    expect(soundcloudEmbedUrl('https://example.com/x')).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/lib/audio-embed.test.ts`

- [ ] **Step 3: Implement `src/lib/audio-embed.ts`**

```ts
// src/lib/audio-embed.ts
export function spotifyEmbedUrl(shareUrl: string): string | null {
  try {
    const u = new URL(shareUrl)
    if (!/(^|\.)spotify\.com$/i.test(u.hostname)) return null
    const m = u.pathname.match(/\/(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/)
    if (!m) return null
    return `https://open.spotify.com/embed/${m[1]}/${m[2]}`
  } catch {
    return null
  }
}

export function soundcloudEmbedUrl(trackUrl: string): string | null {
  try {
    const u = new URL(trackUrl)
    if (!/(^|\.)soundcloud\.com$/i.test(u.hostname)) return null
    const params = `url=${encodeURIComponent(trackUrl)}&auto_play=false&hide_related=true&show_comments=false`
    return `https://w.soundcloud.com/player/?${params}`
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/lib/audio-embed.test.ts`

- [ ] **Step 5: Gate + commit**

Run: `npx tsc --noEmit`; `npx vitest run`.

```bash
git add src/lib/audio-embed.ts src/lib/audio-embed.test.ts
git commit -m "feat(audio): spotify/soundcloud share-link → embed-url converters"
```

---

## Task 3: The `audio-player` element

**Files:**
- Modify: `src/lib/types/canvas.ts`
- Create: `src/components/elements/AudioPlayerElement.tsx`, `src/components/elements/PublicAudioPlayerElement.tsx`
- Modify: `src/components/elements/index.ts`, `SlashCommandMenu.tsx`, `ColumnCanvas.tsx`, `src/lib/render-elements.tsx`
- Test: `src/components/elements/PublicAudioPlayerElement.test.tsx`

**Interfaces:**
- Consumes: `spotifyEmbedUrl`, `soundcloudEmbedUrl` (Task 2); `/api/upload` (Task 1).
- Produces: `ElementType` gains `'audio-player'`; `CanvasElement` gains the `audio*` fields.

**Data model (canvas.ts):**
```ts
// ElementType union (under a "// Batch 2" comment):
  | 'audio-player'
// CanvasElement:
  // Audio player specific
  audioSourceType?: 'file' | 'spotify' | 'soundcloud'
  audioUrl?: string
  audioTitle?: string
  audioArtist?: string
  audioCoverUrl?: string
  audioAutoStart?: boolean
  audioLoop?: boolean
// createElement():
    case 'audio-player':
      return { ...base, audioSourceType: 'file', audioUrl: '', audioTitle: '', audioArtist: '', audioCoverUrl: '', audioAutoStart: false, audioLoop: false }
```

- [ ] **Step 1: Write the failing Public test**

```tsx
// src/components/elements/PublicAudioPlayerElement.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicAudioPlayerElement } from './PublicAudioPlayerElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement>): CanvasElement => ({ id: '1', type: 'audio-player', ...over })

afterEach(() => vi.restoreAllMocks())

describe('PublicAudioPlayerElement', () => {
  it('renders an <audio> for a file source', () => {
    const { container } = render(<PublicAudioPlayerElement element={el({ audioSourceType: 'file', audioUrl: 'https://a.com/song.mp3', audioTitle: 'Song' })} />)
    const audio = container.querySelector('audio')
    expect(audio).toBeTruthy()
    expect(audio?.getAttribute('src')).toBe('https://a.com/song.mp3')
  })
  it('renders a Spotify iframe with the embed src', () => {
    const { container } = render(<PublicAudioPlayerElement element={el({ audioSourceType: 'spotify', audioUrl: 'https://open.spotify.com/track/abc123' })} />)
    const iframe = container.querySelector('iframe')
    expect(iframe?.getAttribute('src')).toBe('https://open.spotify.com/embed/track/abc123')
  })
  it('does NOT call play() on mount when Auto-start is off', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
    render(<PublicAudioPlayerElement element={el({ audioSourceType: 'file', audioUrl: 'https://a.com/song.mp3', audioAutoStart: false })} />)
    expect(play).not.toHaveBeenCalled()
  })
  it('shows a placeholder for a source with no url', () => {
    render(<PublicAudioPlayerElement element={el({ audioSourceType: 'file', audioUrl: '' })} />)
    expect(screen.getByText(/add a track/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/components/elements/PublicAudioPlayerElement.test.tsx`

- [ ] **Step 3: Implement the Public component**

```tsx
// src/components/elements/PublicAudioPlayerElement.tsx
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
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/components/elements/PublicAudioPlayerElement.test.tsx`

- [ ] **Step 5: Implement the editor component**

Create `src/components/elements/AudioPlayerElement.tsx`. Mirror `src/components/elements/ColorPaletteElement.tsx`'s outer shell (selection-ring `div` with `onClick={onSelect}`, top-right delete `X` button when `isSelected` that stops propagation and calls `onDelete()`). Body:
- A 3-way source selector (buttons or a `<select>`) writing `onChange({ audioSourceType: 'file' | 'spotify' | 'soundcloud' })`.
- When `file`: an upload control that POSTs the chosen file to `/api/upload` (mirror the fetch in `src/components/elements/ImageElement.tsx` ~lines 50-85; accept `audio/*`) and writes the returned `url` to `audioUrl`, plus an "or paste audio URL" text input bound to `audioUrl`; text inputs for `audioTitle` and `audioArtist`; a cover-image upload writing `audioCoverUrl` (image); and two checkboxes for `audioAutoStart` and `audioLoop`.
- When `spotify` or `soundcloud`: a single text input bound to `audioUrl` (paste link) plus helper text "Embeds play on press — Auto-start/Loop don't apply."
All updates go through `onChange({ ... })` (immutable partial updates). This component is not required to have its own unit test (the Public renderer is the tested surface, matching other elements).

- [ ] **Step 6: Wire it in** — Read the existing `'color-palette'` case in `ColumnCanvas.tsx` and `render-elements.tsx` to match local names, then:
  - `canvas.ts`: apply the Data model block above.
  - `index.ts`: `export { AudioPlayerElement } from './AudioPlayerElement'` and `export { PublicAudioPlayerElement } from './PublicAudioPlayerElement'` (under a `// Batch 2` comment).
  - `SlashCommandMenu.tsx`: import `Music` from lucide; add `{ id: 'audio-player', label: 'Music Player', icon: Music, description: 'Play a track — upload, URL, Spotify, or SoundCloud', category: 'Media' }`.
  - `ColumnCanvas.tsx`: add
    ```tsx
    case 'audio-player':
      if (isPreviewMode) return <PublicAudioPlayerElement element={element} />
      return (
        <AudioPlayerElement
          element={element}
          onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
          onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
          isSelected={commonProps.isSelected}
          onSelect={commonProps.onSelect}
        />
      )
    ```
    (import both components at the top).
  - `render-elements.tsx`: import `PublicAudioPlayerElement`; add `case 'audio-player': return <PublicAudioPlayerElement element={element} />`.

- [ ] **Step 7: Gate + commit**

Run: `npx tsc --noEmit`; `npx vitest run`.

```bash
git add src/lib/types/canvas.ts src/components/elements/AudioPlayerElement.tsx src/components/elements/PublicAudioPlayerElement.tsx src/components/elements/PublicAudioPlayerElement.test.tsx src/components/elements/index.ts src/components/canvas/SlashCommandMenu.tsx src/components/canvas/ColumnCanvas.tsx src/lib/render-elements.tsx
git commit -m "feat(elements): audio-player (upload/URL custom player + spotify/soundcloud embeds)"
```

---

## Verification (after all tasks)

1. `npx tsc --noEmit` clean; `npx vitest run` fully green.
2. Manual smoke (dev server, logged in, in the editor): add a Music Player element → upload an MP3 (or paste a direct `.mp3` URL); it appears with the custom player. Toggle Auto-start ON, open the published page → after the first click anywhere, the track plays; toggle Loop and confirm it repeats. Switch source to Spotify, paste a track link → the Spotify embed renders (press-play). Same for SoundCloud.
3. Confirm CSP: on the published page, no `Refused to load media/frame` console errors for the Blob audio / Spotify / SoundCloud.

## Self-review notes (checked against spec)

- **Coverage:** upload audio + CSP (T1), embed converters (T2), element model + custom player + embeds + wiring (T3). All spec sections mapped. ✔
- **Auto-start:** attempt-then-first-interaction with listener teardown on unmount / after first interaction; `Promise.resolve(play())` guards jsdom. Test asserts no play() when off. ✔
- **Safety:** iframe `src` only via converters (fixed origins), non-matching → `null` → Placeholder; audio url only in `<audio src>`. ✔
- **No PageEditor edit:** relies on Task-0-era `default:` fallback (already in `createElement`). ✔
- **Type consistency:** `audioSourceType`/`audioUrl`/`audioAutoStart`/`audioLoop` match across canvas.ts, Public component, and the converters' signatures. ✔
