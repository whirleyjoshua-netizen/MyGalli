import Link from 'next/link'
import { Plus } from 'lucide-react'

export function FinalCTA() {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-6 py-10">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-[#f3f8f1] px-6 py-10 shadow-soft sm:px-12">
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
          {/* lily pad + frog accent */}
          <div className="relative hidden h-16 w-24 shrink-0 md:block" aria-hidden>
            <div className="absolute bottom-0 left-0 h-6 w-20 rounded-[50%] bg-galli/40" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/gallio-frog.svg"
              alt=""
              className="absolute bottom-2 left-4 h-14 w-14 drop-shadow"
            />
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Your ideas deserve their own <span className="text-galli">Galli</span>.
          </h2>

          <div className="flex flex-col items-center gap-2">
            <Link
              href="/signup"
              className="inline-flex items-center gap-3 whitespace-nowrap rounded-full bg-foreground px-7 py-3.5 text-base font-semibold text-background shadow-soft-lg transition hover:opacity-90"
            >
              Create your first page
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-galli text-white">
                <Plus className="h-4 w-4" />
              </span>
            </Link>
            <p className="text-xs text-muted-foreground">
              Free to start. Upgrade anytime.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
