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
      'Follow friends, collaborate live, and explore. Whether it\'s for work, passion, or fun — My Galli is for everyone.',
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
