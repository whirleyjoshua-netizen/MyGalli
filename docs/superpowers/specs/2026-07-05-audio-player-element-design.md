# Music Player element (`audio-player`) — design

Date: 2026-07-05
Status: draft (awaiting user review)
Part of: release-roadmap-2026-07 phase 1 (new-elements trench) — a "Batch 2" special element.

## Goal

Add an `audio-player` element so a page owner can attach music — an uploaded file,
a direct audio URL, or a Spotify/SoundCloud link — with an owner option for the
track to **auto-start when a public visitor lands** (MySpace-style) or simply sit
there for visitors to press play.

## The autoplay reality (drives the design)

Browsers block audio autoplay **with sound** until the visitor interacts with the
page. So "auto-start" cannot mean "sound the instant the page loads." The
implemented behavior for **Auto-start = ON** (file source only): on mount, attempt
`audio.play()`; if it rejects (blocked), register one-time page listeners
(`click`, `touchstart`, `keydown`, `scroll`) that start playback on the visitor's
first interaction, then remove themselves. The mini-player is always visible so a
visitor can play/pause/mute regardless. Provider embeds (Spotify/SoundCloud)
cannot auto-start — their iframes are press-play only.

## Sources (owner picks one)

`audioSourceType: 'file' | 'spotify' | 'soundcloud'`

- **`file`** — an uploaded audio file OR a pasted direct audio URL (`.mp3/.m4a/.ogg`
  etc). Rendered as a **custom HTML5 mini-player**. Supports Auto-start + Loop.
- **`spotify`** — a Spotify share link, converted to the embed URL and rendered as
  the official Spotify iframe. Press-play only.
- **`soundcloud`** — a SoundCloud track link, rendered via the SoundCloud iframe
  player. Press-play only.

## Data model (`src/lib/types/canvas.ts`)

Add `'audio-player'` to `ElementType`; add to `CanvasElement`:

```ts
  // Audio player specific
  audioSourceType?: 'file' | 'spotify' | 'soundcloud'
  audioUrl?: string        // direct audio URL (file) OR provider share link
  audioTitle?: string
  audioArtist?: string
  audioCoverUrl?: string   // cover art for the custom player
  audioAutoStart?: boolean // file source only
  audioLoop?: boolean      // file source only
```

`createElement('audio-player')` default: `{ audioSourceType: 'file', audioUrl: '',
audioTitle: '', audioArtist: '', audioCoverUrl: '', audioAutoStart: false,
audioLoop: false }`. (Auto-start defaults OFF — owner opts in.)

## Embed URL converters (pure, testable — `src/lib/audio-embed.ts`)

- `spotifyEmbedUrl(shareUrl): string | null` — `open.spotify.com/{track|album|playlist|artist|episode|show}/{id}[?…]`
  → `https://open.spotify.com/embed/{type}/{id}`; returns `null` if not a Spotify URL.
- `soundcloudEmbedUrl(trackUrl): string | null` — a `soundcloud.com/…` URL →
  `https://w.soundcloud.com/player/?url={encodeURIComponent(trackUrl)}&auto_play=false&hide_related=true&show_comments=false`;
  returns `null` if not a SoundCloud URL.

## Components

- **Editor** `src/components/elements/AudioPlayerElement.tsx` (mirrors the
  selection-ring + delete-button shell of `ColorPaletteElement`):
  - Source-type selector (File / Spotify / SoundCloud).
  - `file`: an upload control (reuses `/api/upload`) + a "or paste audio URL" input;
    title, artist, and cover-image (image upload) inputs; **Auto-start** + **Loop**
    toggles.
  - `spotify` / `soundcloud`: a single "paste link" input, with a note that
    Auto-start/Loop don't apply to embeds.
- **Public** `src/components/elements/PublicAudioPlayerElement.tsx` (`'use client'`):
  - `file`: custom mini-player — optional cover, title/artist, play/pause, a seek
    bar with current/total time, mute; `<audio>` with `loop={audioLoop}`. If
    `audioAutoStart`, run the attempt-then-first-interaction logic on mount;
    listeners cleaned up on unmount. If `audioUrl` is empty, render a neutral
    placeholder.
  - `spotify`/`soundcloud`: render the provider `<iframe>` using the converter
    output; if the link doesn't convert, show a "couldn't load this link"
    placeholder. Never attempts autoplay.

## Backend / config changes

- **`src/app/api/upload/route.ts`**: add audio MIME types to the allowlist
  (`audio/mpeg, audio/mp4, audio/x-m4a, audio/aac, audio/ogg, audio/wav,
  audio/webm`) and make the size limit type-aware — audio up to **25MB**, images
  stay **10MB**. Update the error copy accordingly (also fix the stale "SVG"
  mention that no longer applies).
- **`next.config.js` CSP**: add `media-src 'self' blob: https:` (uploaded Blob audio
  + pasted https audio URLs — accepted tradeoff: permits audio from any https host)
  and extend `frame-src` with `https://open.spotify.com https://w.soundcloud.com`.

## Wiring (the standard add-an-element seams)

`ElementType` + fields + `createElement` (canvas.ts) → `AudioPlayerElement` +
`PublicAudioPlayerElement` → `elements/index.ts` → `SlashCommandMenu` entry
(`{ id: 'audio-player', label: 'Music Player', icon: Music, description: 'Play a track — upload, URL, Spotify, or SoundCloud', category: 'Media' }`)
→ `ColumnCanvas` renderElement case (preview→Public else editor) →
`render-elements.tsx` case. No `PageEditor` edit (the `default:` fallback already
delegates to `createElement`).

## Security / safety

- Audio uploads keep the existing MIME validation + nosniff; audio hosts covered
  by the new `media-src`.
- The `file` `audioUrl` is rendered only as an `<audio src>` (media context, not
  script). Provider links are only used through the pure converters, which emit
  fixed `open.spotify.com` / `w.soundcloud.com` origins — a malformed/foreign URL
  yields `null` → placeholder, never an arbitrary iframe src.

## Testing

- `src/app/api/upload/route.ts`: accepts an audio file; rejects a >25MB file and a
  disallowed type. (Route-level or a focused test around the type/size guard.)
- `src/lib/audio-embed.ts`: `spotifyEmbedUrl` / `soundcloudEmbedUrl` convert valid
  links and return `null` for non-matching input (one assertion each way).
- `PublicAudioPlayerElement`: `file` source renders an `<audio>` element with the
  url; `spotify` source renders an `<iframe>` whose `src` is the embed URL;
  Auto-start OFF does not call `play()` on mount (spy on `HTMLMediaElement.play`).

## Non-goals (v1)

- No sitewide/persistent-across-navigation player (it plays within the page).
- No playlists/queue in the custom player (single track; the existing `playlist`
  element stays separate).
- No Apple Music / YouTube-music sources.

## Files touched

New: `src/lib/audio-embed.ts` (+ test), `src/components/elements/AudioPlayerElement.tsx`,
`src/components/elements/PublicAudioPlayerElement.tsx` (+ test).
Modified: `src/lib/types/canvas.ts`, `src/app/api/upload/route.ts` (+ test),
`next.config.js`, `SlashCommandMenu.tsx`, `ColumnCanvas.tsx`, `render-elements.tsx`,
`src/components/elements/index.ts`.
