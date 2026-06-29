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

export function Testimonial() {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-6 py-10">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quote */}
        <div className="relative flex flex-col justify-center overflow-hidden rounded-3xl border border-border bg-surface p-8 shadow-soft">
          <div className="text-5xl leading-none text-galli/40" aria-hidden>
            &ldquo;
          </div>
          <p className="-mt-3 max-w-sm text-xl font-semibold leading-snug text-foreground">
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/gallio-frog.svg"
            alt=""
            aria-hidden
            className="pointer-events-none absolute -bottom-3 right-4 h-24 w-24 opacity-90 drop-shadow-md"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 rounded-3xl border border-border bg-surface p-6 shadow-soft sm:p-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center justify-center text-center">
              <stat.icon className={`mb-3 h-8 w-8 ${stat.color}`} />
              <div className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                {stat.value}
              </div>
              <div className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
