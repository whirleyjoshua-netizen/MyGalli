'use client'

import { usePathname } from 'next/navigation'
import { BackButton } from './BackButton'

// Consistent back control across all dashboard sub-pages. Rendered once in the
// (dashboard) layout; hidden on the home route (nowhere to go "back" to).
export function PageBackBar() {
  const pathname = usePathname()
  // Hidden on the dashboard home, and on the full-screen hub editor/builder
  // (which carries its own "Back to My Galli" — the outer bar is redundant there).
  if (pathname === '/dashboard' || pathname.startsWith('/hubs/')) return null
  return (
    <div className="px-6 lg:px-8 pt-4">
      <BackButton className="mb-0" />
    </div>
  )
}
