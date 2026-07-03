'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

// Fixed top-left back affordance for public page views. Returns the viewer to
// wherever they came from within the app; falls back to a destination when the
// page was opened in a fresh tab or reached via a shared/external link.
export function BackButton({ fallback = '/explore' }: { fallback?: string }) {
  const router = useRouter()

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1 && document.referrer) {
      try {
        if (new URL(document.referrer).origin === window.location.origin) {
          router.back()
          return
        }
      } catch {
        // malformed referrer — fall through to the fallback
      }
    }
    router.push(fallback)
  }

  return (
    <button
      onClick={handleBack}
      aria-label="Go back"
      className="fixed top-4 left-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md shadow-soft-lg ring-1 ring-white/20 hover:bg-black/55 transition-colors cursor-pointer"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  )
}
