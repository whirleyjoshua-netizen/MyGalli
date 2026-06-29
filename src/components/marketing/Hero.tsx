import Link from 'next/link'
import { Plus, Pencil, Link2, Heart } from 'lucide-react'

const SIGNPOSTS = [
  { label: 'Create', icon: Pencil },
  { label: 'Share', icon: Link2 },
  { label: 'Inspire', icon: Heart },
]

/** CTA block reused by both the image hero and the CSS fallback. */
function HeroCta() {
  return (
    <div className="flex flex-col items-center gap-3">
      <Link
        href="/signup"
        className="inline-flex items-center gap-3 rounded-full bg-foreground px-8 py-4 text-base font-semibold text-background shadow-soft-lg transition hover:opacity-90"
      >
        Create your first page
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-galli text-white">
          <Plus className="h-4 w-4" />
        </span>
      </Link>
      <p className="text-sm font-medium text-[#33493b]">
        No code. No limits. Just your ideas.
      </p>
    </div>
  )
}

/**
 * Hero with progressive-enhancement art.
 * - If `imageSrc` is provided (e.g. /hero-village.png) the generated
 *   illustration — which already contains the "Welcome to My Galli" sign and
 *   frog — is shown, and only the CTA is overlaid (no duplicate CSS sign).
 * - Otherwise a hand-built CSS storybook scene with a live headline is shown.
 */
export function Hero({ imageSrc }: { imageSrc?: string | null }) {
  if (imageSrc) {
    return (
      <section className="relative z-10 pb-12">
        {/* Clean full-bleed illustration — sign + frog already live in the art */}
        <div className="relative w-full overflow-hidden rounded-b-[3rem] border-b border-border shadow-soft-lg">
          {/* Accessible/SEO heading — the visual headline lives in the image */}
          <h1 className="sr-only">My Galli — make any idea interactive.</h1>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt="Welcome to My Galli — a storybook village with a wooden sign and frog mascot."
            className="h-auto w-full object-cover"
          />
        </div>
        {/* CTA sits below the image, not over it */}
        <div className="mt-8 flex justify-center px-4">
          <HeroCta />
        </div>
      </section>
    )
  }

  return (
    <section className="relative z-10 pb-16">
      <div className="relative w-full overflow-hidden rounded-b-[3rem] border-b border-border shadow-soft-lg">
        {/* CSS storybook scene fallback */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* sky */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#bfe9ff] via-[#dff6ec] to-[#eafaf1]" />
          {/* sun glow */}
          <div className="absolute -right-10 top-6 h-40 w-40 rounded-full bg-white/60 blur-2xl" />
          {/* clouds */}
          <div className="absolute left-10 top-10 h-10 w-28 rounded-full bg-white/80 blur-md" />
          <div className="absolute right-24 top-16 h-8 w-24 rounded-full bg-white/70 blur-md" />
          {/* hills */}
          <div className="absolute -bottom-24 -left-16 h-64 w-[60%] rounded-[50%] bg-[#8fd6a6]" />
          <div className="absolute -bottom-28 right-0 h-72 w-[65%] rounded-[50%] bg-[#7ccb97]" />
          <div className="absolute -bottom-16 left-1/4 h-56 w-[55%] rounded-[50%] bg-[#6dc08a]" />
          {/* pond */}
          <div className="absolute bottom-6 left-10 h-16 w-48 rounded-[50%] bg-[#7cc6ef]/80 blur-[1px]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-6 px-6 py-16 sm:px-12 md:py-28 lg:grid-cols-[1fr_auto]">
          {/* Wooden sign + copy */}
          <div className="mx-auto max-w-2xl text-center">
            <div className="relative inline-block rounded-3xl border-4 border-[#a9743f] bg-[#fbf5e6] px-8 py-8 shadow-[0_10px_40px_rgba(80,50,20,.18)] sm:px-14">
              <span className="absolute -left-2 -top-5 h-10 w-3 rounded-full bg-[#a9743f]" aria-hidden />
              <span className="absolute -right-2 -top-5 h-10 w-3 rounded-full bg-[#a9743f]" aria-hidden />
              <p className="font-medium text-[#a9743f]">Welcome to</p>
              <h1 className="mt-1 text-5xl font-extrabold uppercase tracking-tight text-[#1d3b2a] sm:text-6xl">
                My Galli
              </h1>
              <p className="mt-4 text-lg text-[#33493b]">
                Make any idea{' '}
                <span className="font-semibold text-galli-violet">interactive</span>.
                <br />
                Share it with the{' '}
                <span className="font-semibold text-galli-aqua">world</span>.
              </p>
            </div>

            <div className="mt-8">
              <HeroCta />
            </div>
          </div>

          {/* Signposts (Create / Share / Inspire) */}
          <div className="hidden flex-col gap-3 lg:flex">
            {SIGNPOSTS.map((post) => (
              <div
                key={post.label}
                className="flex items-center gap-2 rounded-r-xl rounded-l-md border-2 border-[#a9743f] bg-[#c98f56] px-5 py-2.5 font-semibold text-white shadow-soft"
              >
                <post.icon className="h-4 w-4" />
                {post.label}
              </div>
            ))}
          </div>
        </div>

        {/* Frog mascot */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/gallio-frog.svg"
          alt=""
          aria-hidden
          className="absolute bottom-4 left-4 h-20 w-20 drop-shadow-md sm:bottom-8 sm:left-10 sm:h-28 sm:w-28"
        />
      </div>
    </section>
  )
}
