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
