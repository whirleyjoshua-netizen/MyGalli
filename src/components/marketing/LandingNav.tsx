import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const NAV_LINKS = [
  { label: 'Explore', href: '/explore' },
]

export function LandingNav() {
  return (
    <nav className="relative z-20 flex w-full items-center justify-between bg-gradient-to-r from-galli via-galli-aqua to-galli-violet px-6 py-4 text-white shadow-soft-lg sm:px-10">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gallio-frog.svg" alt="" aria-hidden className="h-7 w-7" />
        </span>
        <span className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">
          My Galli
        </span>
      </Link>

      <div className="hidden items-center gap-8 md:flex">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="text-sm font-semibold text-white/85 transition hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="rounded-full border border-white/40 bg-white/15 px-5 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-galli-dark shadow-soft transition hover:bg-white/90"
        >
          Get started
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </nav>
  )
}
