'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronRight } from 'lucide-react'

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

export function TemplateCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 280, behavior: 'smooth' })
  }

  return (
    <section className="relative z-10 mx-auto max-w-7xl px-6 py-10">
      <div className="rounded-3xl bg-[#f3f8f1] p-6 sm:p-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Start with <span className="text-galli">inspiration</span> 🌿
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a template and make it yours.
            </p>
          </div>
          <Link
            href="/explore"
            className="hidden items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-foreground transition hover:text-galli sm:flex"
          >
            Explore all templates
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="relative">
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {TEMPLATES.map((tpl) => (
              <Link
                key={tpl.name}
                href="/signup"
                className="group w-44 shrink-0"
              >
                <div
                  className={`flex h-28 items-center justify-center rounded-2xl bg-gradient-to-br ${tpl.gradient} text-4xl shadow-soft transition group-hover:shadow-soft-lg`}
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

          <button
            type="button"
            onClick={scrollRight}
            aria-label="Scroll templates"
            className="absolute -right-2 top-10 hidden h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-soft-lg transition hover:bg-muted sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  )
}
