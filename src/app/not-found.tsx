import Link from 'next/link'

// Branded 404 for unknown routes.
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl font-extrabold tracking-tight text-galli-gradient">404</div>
      <h1 className="mt-3 text-xl font-bold">This page hopped away</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        We couldn&apos;t find what you were looking for. It may have moved, or never existed.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
      >
        Back home
      </Link>
    </div>
  )
}
