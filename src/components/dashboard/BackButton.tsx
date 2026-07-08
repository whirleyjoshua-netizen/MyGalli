'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

/**
 * Consistent "go back to where you came from" control.
 * Uses browser history (router.back()); falls back to /dashboard when there's
 * no history to return to (direct link / refresh). `iconOnly` for header bars.
 */
export function BackButton({
  className = '',
  label = 'Back',
  iconOnly = false,
}: {
  className?: string
  label?: string
  iconOnly?: boolean
}) {
  const router = useRouter()
  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/dashboard')
  }
  if (iconOnly) {
    return (
      <button onClick={goBack} aria-label={label} className={`p-2 hover:bg-muted rounded-lg transition text-muted-foreground hover:text-foreground ${className}`}>
        <ArrowLeft className="w-4 h-4" />
      </button>
    )
  }
  return (
    <button
      onClick={goBack}
      className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-4 cursor-pointer ${className}`}
    >
      <ArrowLeft className="w-4 h-4" /> {label}
    </button>
  )
}
