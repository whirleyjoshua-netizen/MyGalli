'use client'

import { usePathname } from 'next/navigation'
import { BackButton } from './BackButton'

// Top-level pages that render a full-bleed PageHero cover. The separate back bar
// would push the cover down and break its bleed-to-top, and these are all
// reachable from the sidebar — so no redundant back control here.
const PAGE_HERO_ROUTES = [
  '/my-pages', '/shared', '/workspaces', '/data', '/library', '/settings', '/bulletin', '/responses', '/explore',
]

// Consistent back control across dashboard sub-pages. Rendered once in the
// (dashboard) layout; hidden on the home route, the hub editor, and the
// full-bleed PageHero landing pages.
export function PageBackBar() {
  const pathname = usePathname()
  // Hidden on the dashboard home, the full-screen hub editor/builder (which
  // carries its own "Back to My Galli"), and the PageHero cover pages (exact
  // match so deeper routes like /workspaces/[id] still get a back control).
  if (pathname === '/dashboard' || pathname.startsWith('/hubs/')) return null
  if (PAGE_HERO_ROUTES.includes(pathname)) return null
  return (
    <div className="px-6 lg:px-8 pt-4">
      <BackButton className="mb-0" />
    </div>
  )
}
