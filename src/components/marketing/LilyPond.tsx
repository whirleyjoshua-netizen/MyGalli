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
