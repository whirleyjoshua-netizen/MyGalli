# Lily Pond Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scrolling My Galli marketing landing page with a single fixed, no-scroll "lily pond" scene where the former bottom-of-page content floats on the hero image as clickable lily pads that open themed popups.

**Architecture:** A single client component (`LilyPond`) renders the full-viewport scene over `hero-village.png`: a translucent glass nav, a persistent sign-up CTA, and three lily pads. Each pad opens a storybook-themed modal (`PadModal`) whose body is one of three popup components reusing the existing feature/template/testimonial copy and art. A responsive split gives desktop the fixed scene and phones a banner + stacked-button fallback. `page.tsx` is reduced to rendering `<LilyPond />`.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, lucide-react icons.

## Global Constraints

- Brand display name is **"My Galli"** — never write "Gallio".
- Use existing Tailwind tokens verbatim: `galli`, `galli-dark`, `galli-aqua`, `galli-violet`, `foreground`, `background`, `muted`, `muted-foreground`, `surface`, `border`, `shadow-soft`, `shadow-soft-lg`.
- Frog mascot asset: `public/gallio-frog.svg` (filename unchanged — internal asset).
- Hero art: `public/hero-village.png` (already present). Do not add new art.
- No new unit tests for these presentational components (per spec). Per-task verification is `npx tsc --noEmit` passing + a live render check; keep `pnpm test` green (no existing tests should break).
- Windows build gotcha: do NOT run `pnpm build` while `pnpm dev` is running. Use `npx tsc --noEmit` + live checks.
- All link targets already exist: `/signup`, `/login`, `/explore`.
- Files live under `src/components/marketing/`.

---

### Task 1: PadModal — storybook-themed modal wrapper

**Files:**
- Create: `src/components/marketing/PadModal.tsx`

**Interfaces:**
- Consumes: nothing (leaf component).
- Produces: `export function PadModal(props: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }): JSX.Element | null`. Renders nothing when `isOpen` is false. Closes on Escape, on backdrop click, and via an X button. Locks body scroll while open, focuses the dialog on open, and restores focus to the previously focused element on close. Body scrolls internally when content exceeds `max-h-[85vh]`.

- [ ] **Step 1: Create the component file**

Create `src/components/marketing/PadModal.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface PadModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

/**
 * Storybook-themed modal used by the lily-pond landing scene.
 * Cream/parchment card with a wooden-brown border and green heading.
 * Closes on Escape, backdrop click, and the X button. Locks body scroll
 * while open and restores focus to the trigger on close. Tall content
 * scrolls inside the card so the page underneath never scrolls.
 */
export function PadModal({ isOpen, onClose, title, children }: PadModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const prevActive = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prevActive?.focus?.()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F3D2E]/55 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border-4 border-[#a9743f] bg-[#fbf5e6] shadow-[0_20px_60px_rgba(80,50,20,.35)] outline-none"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#a9743f]/30 px-6 py-4">
          <h2 className="text-xl font-extrabold tracking-tight text-galli-dark sm:text-2xl">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#a9743f]/15 text-[#7a5226] transition hover:bg-[#a9743f]/25"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/PadModal.tsx
git commit -m "feat(landing): storybook-themed PadModal wrapper"
```

---

### Task 2: Popup content components

**Files:**
- Create: `src/components/marketing/popups/FeaturesPopup.tsx`
- Create: `src/components/marketing/popups/TemplatesPopup.tsx`
- Create: `src/components/marketing/popups/LovedPopup.tsx`

**Interfaces:**
- Consumes: nothing (leaf presentational components).
- Produces: `export function FeaturesPopup(): JSX.Element`, `export function TemplatesPopup(): JSX.Element`, `export function LovedPopup(): JSX.Element`. Each renders a popup body intended to sit inside `PadModal`'s scrollable content area. Copy and CSS art are reused verbatim from the existing `FeatureSection.tsx`, `TemplateCarousel.tsx`, and `Testimonial.tsx`.

- [ ] **Step 1: Create `FeaturesPopup.tsx`**

Create `src/components/marketing/popups/FeaturesPopup.tsx`:

```tsx
import { Link2 } from 'lucide-react'

/* CSS "mock UI" art reused from the former FeatureSection. */

function AnythingArt() {
  return (
    <div className="flex h-28 items-center justify-center rounded-xl bg-muted/60">
      <div className="flex w-32 gap-2 rounded-lg bg-surface p-2 shadow-soft">
        <div className="flex-1 space-y-1.5">
          <div className="h-2 w-6 rounded-full bg-galli-violet" />
          <div className="h-1.5 w-full rounded-full bg-muted" />
          <div className="h-1.5 w-3/4 rounded-full bg-muted" />
          <div className="h-1.5 w-5/6 rounded-full bg-muted" />
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-galli/20">
          <div className="h-7 w-7 rounded bg-galli" />
        </div>
      </div>
    </div>
  )
}

function InteractiveArt() {
  return (
    <div className="flex h-28 items-center justify-center rounded-xl bg-muted/60">
      <div className="w-36 rounded-lg bg-surface p-2.5 shadow-soft">
        <div className="mb-2 h-1.5 w-2/3 rounded-full bg-muted" />
        <div className="mb-1.5 rounded-md border border-border px-2 py-1.5 text-[10px] text-muted-foreground">
          Mountains
        </div>
        <div className="flex items-center justify-between rounded-md bg-galli/15 px-2 py-1.5 text-[10px] font-medium text-galli-dark">
          Beach
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-galli text-[8px] text-white">
            ✓
          </span>
        </div>
      </div>
    </div>
  )
}

function ShareArt() {
  return (
    <div className="relative flex h-28 items-center justify-center rounded-xl bg-muted/60">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-galli-violet text-white shadow-soft-lg">
        <Link2 className="h-5 w-5" />
      </div>
      <div className="absolute left-6 top-7 h-7 w-7 rounded-full bg-galli/40" />
      <div className="absolute bottom-6 right-7 h-6 w-6 rounded-full bg-galli-aqua/50" />
    </div>
  )
}

function EveryoneArt() {
  return (
    <div className="flex h-28 items-center justify-center rounded-xl bg-muted/60">
      <div className="flex -space-x-2">
        <div className="h-9 w-9 rounded-full border-2 border-surface bg-galli-aqua/70" />
        <div className="h-9 w-9 rounded-full border-2 border-surface bg-galli/70" />
        <div className="h-9 w-9 rounded-full border-2 border-surface bg-galli-violet/70" />
        <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface bg-foreground text-[10px] font-semibold text-background">
          +9
        </div>
      </div>
    </div>
  )
}

const FEATURES = [
  {
    art: AnythingArt,
    title: 'Anything, your way',
    description:
      'Build a page for any idea — athlete profile, resume, wedding, mood board, guide. Drag, drop, done.',
  },
  {
    art: InteractiveArt,
    title: 'Interactive by default',
    description:
      'Add polls, questions, quizzes, ratings, and trackers. Make your page come alive, not just sit there.',
  },
  {
    art: ShareArt,
    title: 'Share anywhere',
    description:
      'Get a clean link at galli.page/you instantly. Embed it, share it, make it yours.',
  },
  {
    art: EveryoneArt,
    title: 'Built for everyone',
    description:
      'Follow friends, collaborate live, and explore. Whether it’s for work, passion, or fun — My Galli is for everyone.',
  },
]

export function FeaturesPopup() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {FEATURES.map((feature) => (
        <div
          key={feature.title}
          className="rounded-2xl border border-border bg-surface p-4 shadow-soft"
        >
          <feature.art />
          <h3 className="mt-4 font-bold">{feature.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {feature.description}
          </p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `TemplatesPopup.tsx`**

Create `src/components/marketing/popups/TemplatesPopup.tsx`:

```tsx
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type Template = {
  name: string
  tag: 'Popular' | 'New'
  emoji: string
  gradient: string
}

const TEMPLATES: Template[] = [
  { name: 'Athlete Profile', tag: 'Popular', emoji: '🏈', gradient: 'from-galli/30 to-galli-aqua/20' },
  { name: 'Resume', tag: 'Popular', emoji: '📄', gradient: 'from-galli-aqua/30 to-galli-violet/20' },
  { name: 'Wedding', tag: 'New', emoji: '💍', gradient: 'from-pink-300/40 to-galli-violet/20' },
  { name: 'Travel Map', tag: 'Popular', emoji: '🗺️', gradient: 'from-galli-aqua/30 to-galli/20' },
  { name: 'Mood Board', tag: 'New', emoji: '🎨', gradient: 'from-galli-violet/30 to-pink-300/20' },
  { name: 'Book List', tag: 'Popular', emoji: '📚', gradient: 'from-amber-300/40 to-galli/20' },
]

const TAG_STYLES: Record<Template['tag'], string> = {
  Popular: 'bg-galli-violet/10 text-galli-violet',
  New: 'bg-galli/15 text-galli-dark',
}

export function TemplatesPopup() {
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Pick a template and make it yours.
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {TEMPLATES.map((tpl) => (
          <Link key={tpl.name} href="/signup" className="group">
            <div
              className={`flex h-24 items-center justify-center rounded-2xl bg-gradient-to-br ${tpl.gradient} text-4xl shadow-soft transition group-hover:shadow-soft-lg`}
            >
              {tpl.emoji}
            </div>
            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold">{tpl.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TAG_STYLES[tpl.tag]}`}
              >
                {tpl.tag}
              </span>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-6 flex justify-center">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition hover:text-galli"
        >
          Explore all templates
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `LovedPopup.tsx`**

Create `src/components/marketing/popups/LovedPopup.tsx`:

```tsx
import { FileText, Users, Globe } from 'lucide-react'

/*
 * NOTE: testimonial quote and stats below are marketing PLACEHOLDER copy.
 * Swap with real numbers / a real customer quote before launch.
 */

const STATS = [
  { icon: FileText, value: '10K+', label: 'Pages created', color: 'text-galli-violet' },
  { icon: Users, value: '200K+', label: 'Interactions', color: 'text-galli' },
  { icon: Globe, value: '150+', label: 'Countries', color: 'text-amber-500' },
]

export function LovedPopup() {
  return (
    <div className="space-y-6">
      <div className="relative rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div className="text-5xl leading-none text-galli/40" aria-hidden>
          &ldquo;
        </div>
        <p className="-mt-3 text-xl font-semibold leading-snug text-foreground">
          My Galli turns my thoughts into interactive experiences people actually
          enjoy.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-galli/20 text-sm font-bold text-galli-dark">
            MT
          </div>
          <div>
            <p className="text-sm font-semibold">Maya Thompson</p>
            <p className="text-xs text-muted-foreground">Creator &amp; Designer</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-2xl border border-border bg-surface p-6 shadow-soft">
        {STATS.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center justify-center text-center">
            <stat.icon className={`mb-3 h-8 w-8 ${stat.color}`} />
            <div className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {stat.value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/popups/
git commit -m "feat(landing): feature/template/testimonial popup bodies"
```

---

### Task 3: LilyPond — the fixed scene + responsive fallback

**Files:**
- Create: `src/components/marketing/LilyPond.tsx`

**Interfaces:**
- Consumes: `PadModal` from `./PadModal`; `FeaturesPopup` from `./popups/FeaturesPopup`; `TemplatesPopup` from `./popups/TemplatesPopup`; `LovedPopup` from `./popups/LovedPopup`.
- Produces: `export function LilyPond(props: { imageSrc?: string | null }): JSX.Element`. Renders the full-viewport scene (glass nav + persistent CTA + three pads) at `md` and up, and a banner + stacked-button layout below `md`. Owns `openPad` state and wires each pad to its popup. Falls back to a CSS gradient background when `imageSrc` is null.

- [ ] **Step 1: Create the component file**

Create `src/components/marketing/LilyPond.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, ArrowRight, ChevronRight } from 'lucide-react'
import { PadModal } from './PadModal'
import { FeaturesPopup } from './popups/FeaturesPopup'
import { TemplatesPopup } from './popups/TemplatesPopup'
import { LovedPopup } from './popups/LovedPopup'

type PadId = 'features' | 'templates' | 'loved'

const PADS: { id: PadId; label: string; title: string }[] = [
  { id: 'features', label: 'Your world,\nyour rules', title: 'Your world, your rules' },
  { id: 'templates', label: 'Start with\ninspiration', title: 'Start with inspiration' },
  { id: 'loved', label: 'Loved by\ncreators', title: 'Loved by creators' },
]

// Desktop absolute positions per pad (tuned live in Task 4).
const PAD_POS: Record<PadId, string> = {
  features: 'bottom-[15%] left-[12%]',
  templates: 'bottom-[5%] left-1/2 -translate-x-1/2',
  loved: 'bottom-[17%] right-[13%]',
}

function GlassNav() {
  return (
    <nav className="flex w-full items-center justify-between border-b border-white/20 bg-[#0F3D2E]/35 px-6 py-3.5 backdrop-blur-md sm:px-10">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gallio-frog.svg" alt="" aria-hidden className="h-6 w-6" />
        </span>
        <span className="text-xl font-extrabold tracking-tight text-white drop-shadow">
          My Galli
        </span>
      </Link>
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="rounded-full border border-white/40 bg-white/15 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-galli-dark shadow-soft transition hover:bg-white/90"
        >
          Get started
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </nav>
  )
}

function PrimaryCta() {
  return (
    <div className="flex flex-col items-center gap-2">
      <Link
        href="/signup"
        className="inline-flex items-center gap-3 rounded-full bg-foreground px-7 py-3.5 text-base font-semibold text-background shadow-soft-lg transition hover:opacity-90"
      >
        Create your first page
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-galli text-white">
          <Plus className="h-4 w-4" />
        </span>
      </Link>
      <p className="text-sm font-semibold text-[#1d3b2a] drop-shadow-sm">
        No code. No limits. Just your ideas.
      </p>
    </div>
  )
}

function LilyPad({
  label,
  onClick,
  className,
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className={`group absolute flex flex-col items-center outline-none ${className ?? ''}`}
    >
      <span className="relative flex h-24 w-36 items-center justify-center rounded-[46%] bg-gradient-to-br from-[#84d3a0] to-[#4ea873] shadow-[0_10px_26px_rgba(15,61,46,.4)] ring-2 ring-[#3f8f63]/50 transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-[0_18px_34px_rgba(15,61,46,.45)] group-focus-visible:ring-4 group-focus-visible:ring-white">
        <span aria-hidden className="absolute inset-2 rounded-[46%] border border-white/20" />
        <span className="whitespace-pre-line px-2 text-center text-sm font-extrabold leading-tight text-[#0F3D2E] drop-shadow-sm">
          {label}
        </span>
      </span>
    </button>
  )
}

export function LilyPond({ imageSrc }: { imageSrc?: string | null }) {
  const [openPad, setOpenPad] = useState<PadId | null>(null)

  const background = imageSrc ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc}
      alt=""
      aria-hidden
      className="absolute inset-0 h-full w-full object-cover object-center"
    />
  ) : (
    <div
      aria-hidden
      className="absolute inset-0 bg-gradient-to-b from-[#bfe9ff] via-[#dff6ec] to-[#eafaf1]"
    />
  )

  return (
    <main className="relative min-h-[100svh] w-full overflow-x-hidden md:h-[100svh] md:overflow-hidden">
      <h1 className="sr-only">My Galli — make any idea interactive.</h1>

      {/* ---------- Desktop / tablet: fixed full-bleed scene ---------- */}
      <div className="relative hidden h-[100svh] w-full md:block">
        {background}
        <div className="absolute inset-x-0 top-0 z-30">
          <GlassNav />
        </div>
        <div className="absolute left-1/2 top-[60%] z-20 -translate-x-1/2">
          <PrimaryCta />
        </div>
        {PADS.map((pad) => (
          <LilyPad
            key={pad.id}
            label={pad.label}
            onClick={() => setOpenPad(pad.id)}
            className={`z-20 ${PAD_POS[pad.id]}`}
          />
        ))}
      </div>

      {/* ---------- Mobile: banner + stacked buttons ---------- */}
      <div className="flex min-h-[100svh] flex-col md:hidden">
        <GlassNav />
        <div className="relative h-52 w-full shrink-0 overflow-hidden">{background}</div>
        <div className="flex flex-1 flex-col gap-3 bg-gradient-to-b from-[#eafaf1] to-background px-5 py-6">
          <div className="mb-1 text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-galli-dark">
              Make any idea interactive.
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Tap a lily pad to explore.</p>
          </div>
          {PADS.map((pad) => (
            <button
              key={pad.id}
              type="button"
              onClick={() => setOpenPad(pad.id)}
              aria-haspopup="dialog"
              className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-[#84d3a0] to-[#4ea873] px-5 py-4 text-left font-extrabold text-[#0F3D2E] shadow-[0_8px_20px_rgba(15,61,46,.3)] ring-2 ring-[#3f8f63]/40 transition active:scale-[.98]"
            >
              {pad.title}
              <ChevronRight className="h-5 w-5" />
            </button>
          ))}
          <div className="mt-3 flex justify-center">
            <PrimaryCta />
          </div>
        </div>
      </div>

      {/* ---------- Shared popups ---------- */}
      <PadModal
        isOpen={openPad === 'features'}
        onClose={() => setOpenPad(null)}
        title="Your world, your rules"
      >
        <FeaturesPopup />
      </PadModal>
      <PadModal
        isOpen={openPad === 'templates'}
        onClose={() => setOpenPad(null)}
        title="Start with inspiration"
      >
        <TemplatesPopup />
      </PadModal>
      <PadModal
        isOpen={openPad === 'loved'}
        onClose={() => setOpenPad(null)}
        title="Loved by creators"
      >
        <LovedPopup />
      </PadModal>
    </main>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/LilyPond.tsx
git commit -m "feat(landing): fixed lily-pond scene with responsive fallback"
```

---

### Task 4: Wire into the landing route + live verification + position tuning

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `LilyPond` from `@/components/marketing/LilyPond`.
- Produces: the `/` route renders only `<LilyPond imageSrc={heroImage} />`.

- [ ] **Step 1: Replace `page.tsx` body**

Replace the entire contents of `src/app/page.tsx` with:

```tsx
import { existsSync } from 'fs'
import { join } from 'path'
import { LilyPond } from '@/components/marketing/LilyPond'

/**
 * Progressive-enhancement hero art: drop a generated illustration at
 * `public/hero-village.png` (or .jpg/.webp) and the lily-pond scene uses it
 * as the full-bleed background. Falls back to a CSS gradient if absent.
 */
function resolveHeroImage(): string | null {
  const candidates = ['hero-village.png', 'hero-village.jpg', 'hero-village.webp']
  for (const file of candidates) {
    if (existsSync(join(process.cwd(), 'public', file))) {
      return `/${file}`
    }
  }
  return null
}

export default function Home() {
  const heroImage = resolveHeroImage()

  return <LilyPond imageSrc={heroImage} />
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the existing test suite**

Run: `pnpm test`
Expected: all tests pass (no existing tests reference the landing components, so the count is unchanged).

- [ ] **Step 4: Live render check (dev server)**

With `pnpm dev` running, open `http://localhost:3000`. Confirm at a desktop width (≥ `md`):
- The hero fills the viewport with no page scrollbar.
- The glass nav (logo + Log in + Get started), the persistent "Create your first page" CTA, and all three lily pads are visible and not overlapping the "MY GALLI" sign or each other.
- Each pad opens the correct popup; the popup closes via the X button, a backdrop click, and the Escape key; focus returns to the pad after closing.
- A tall popup scrolls inside the card while the page stays put.

Then narrow the window below `md`: confirm the banner + stacked-button fallback renders cleanly and the same popups open.

- [ ] **Step 5: Tune pad/CTA positions if needed**

If any pad overlaps the sign, the CTA, or another pad, adjust the Tailwind position values in `LilyPond.tsx` — `PAD_POS` (per-pad `bottom-[..]`/`left-[..]`/`right-[..]`) and the CTA wrapper's `top-[60%]` — and re-check live. Repeat until the scene reads cleanly. (Pure class-value edits; no structural change.)

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/components/marketing/LilyPond.tsx
git commit -m "feat(landing): render fixed lily-pond scene at / and tune layout"
```

---

## Self-Review

**Spec coverage:**
- Fixed no-scroll full-viewport scene over `hero-village.png` → Task 3 (`md:h-[100svh] md:overflow-hidden`, `object-cover`), Task 4 wiring.
- Translucent glass nav → Task 3 `GlassNav`.
- Persistent CTA (with subline; absorbs old FinalCTA) → Task 3 `PrimaryCta`.
- Three themed pads → popups mapping (features / templates / loved) → Task 3 `PADS` + Task 2 popup bodies (copy/art reused verbatim).
- Storybook modal: dimmed overlay, cream card, wooden border, green heading, X, Escape, backdrop click, focus restore, internal scroll, body-scroll lock → Task 1 `PadModal`.
- Mobile graceful fallback (banner + stacked buttons) → Task 3 `md:hidden` branch.
- Hidden accessible `h1` → Task 3. `aria-haspopup="dialog"` on pads → Task 3. Labelled `role="dialog"` + `aria-modal` → Task 1.
- CSS background fallback when no hero image → Task 3 `background` branch; `resolveHeroImage()` retained → Task 4.
- LandingFooter dropped, old components retained-not-deleted → satisfied by Task 4 (page no longer composes them; no deletions in plan).
- Verification via `tsc --noEmit` + live + keep `pnpm test` green → Tasks 1–4.

**Placeholder scan:** No TBD/TODO/"handle edge cases" steps; all code blocks are complete. The only "PLACEHOLDER" text is the intentional marketing-copy comment carried over from `Testimonial.tsx` (flagged in spec).

**Type consistency:** `PadId` union (`'features' | 'templates' | 'loved'`) is consistent across `PADS`, `PAD_POS`, `openPad` state, and the three `PadModal` `isOpen` checks. `PadModal` prop names (`isOpen`, `onClose`, `title`, `children`) match all three call sites. Popup component names (`FeaturesPopup`, `TemplatesPopup`, `LovedPopup`) match their imports and usages.
