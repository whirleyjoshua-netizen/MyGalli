import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import type { Section } from '@/lib/types/canvas'
import type { BackgroundConfig } from '@/lib/types/background'
import { getBackgroundStyles, DEFAULT_BACKGROUND_CONFIG } from '@/lib/types/background'
import type { SpacingConfig } from '@/lib/types/spacing'
import { getSpacingStyles, getContainerStyle } from '@/lib/types/spacing'
import type { HeaderCardConfig } from '@/lib/types/header-card'
import type { TabsConfig } from '@/lib/types/tabs'
import { PageViewTracker } from '@/components/analytics/PageViewTracker'
import { renderElement, getGridClass, getColumnStyles } from '@/lib/render-elements'
import { PublicHeaderCard } from '@/components/header/PublicHeaderCard'
import { PublicTabView } from '@/components/tabs/PublicTabView'
import { FontLoader } from '@/components/FontLoader'
import { cookies } from 'next/headers'
import { verify } from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/auth'
import { AUTH_COOKIE } from '@/lib/constants'
import { deriveFriend } from '@/lib/social'
import { CreatorChip } from '@/components/social/CreatorChip'

interface Props {
  params: Promise<{ username: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params

  const user = await db.user.findUnique({
    where: { username },
    select: { id: true, name: true, username: true },
  })

  if (!user) return {}

  const display = await db.display.findUnique({
    where: { userId_slug: { userId: user.id, slug } },
    select: { title: true, published: true, coverImage: true },
  })

  if (!display || !display.published) return {}

  const displayName = user.name || user.username
  const title = display.title
  const description = `${title} by ${displayName} on My Galli`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://galli.page'
  const pageUrl = `${appUrl}/${username}/${slug}`
  // Use the page's own cover as the share preview when set; otherwise the route
  // falls back to the site-wide branded opengraph-image.
  const images = display.coverImage ? [{ url: display.coverImage }] : undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: pageUrl,
      ...(images && { images }),
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(images && { images }),
    },
    alternates: {
      canonical: pageUrl,
    },
  }
}

export default async function PublicDisplayPage({ params }: Props) {
  const { username, slug } = await params

  const user = await db.user.findUnique({
    where: { username },
    select: { id: true, username: true, name: true, avatar: true },
  })

  if (!user) {
    notFound()
  }

  const display = await db.display.findUnique({
    where: {
      userId_slug: { userId: user.id, slug },
    },
  })

  if (!display || !display.published) {
    notFound()
  }

  // Viewer follow state (for the author follow button)
  let meId: string | null = null
  const token = (await cookies()).get(AUTH_COOKIE)?.value
  if (token) {
    try { meId = (verify(token, getJwtSecret()) as { userId: string }).userId } catch { meId = null }
  }
  const isOwner = meId === user.id
  let viewerIsFollowing = false
  let viewerIsFriend = false
  if (meId && !isOwner) {
    const [iFollow, followsMe] = await Promise.all([
      db.follow.findUnique({ where: { followerId_followingId: { followerId: meId, followingId: user.id } }, select: { id: true } }),
      db.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: meId } }, select: { id: true } }),
    ])
    viewerIsFollowing = !!iFollow
    viewerIsFriend = deriveFriend(viewerIsFollowing, !!followsMe)
  }

  // Persistent creator affordance — shown to everyone except the owner, across
  // all layout branches (header card, tabs, plain page).
  const creatorChip = !isOwner ? (
    <CreatorChip
      username={user.username}
      name={user.name}
      avatar={user.avatar}
      slug={slug}
      isAuthed={!!meId}
      viewerIsFollowing={viewerIsFollowing}
      viewerIsFriend={viewerIsFriend}
    />
  ) : null

  // Parse sections
  const sections: Section[] =
    typeof display.sections === 'string'
      ? JSON.parse(display.sections)
      : (display.sections as unknown as Section[]) || []

  // Parse background
  const background: BackgroundConfig =
    typeof display.background === 'string'
      ? JSON.parse(display.background)
      : (display.background as unknown as BackgroundConfig) || DEFAULT_BACKGROUND_CONFIG

  // Parse header card
  const headerCard: HeaderCardConfig | null = display.headerCard
    ? (typeof display.headerCard === 'string'
        ? JSON.parse(display.headerCard)
        : display.headerCard as unknown as HeaderCardConfig)
    : null

  // Parse tabs
  const tabsConfig: TabsConfig | null = display.tabs
    ? (typeof display.tabs === 'string'
        ? JSON.parse(display.tabs)
        : display.tabs as unknown as TabsConfig)
    : null

  const backgroundStyles = getBackgroundStyles(background)

  // Parse spacing (null on legacy pages → defaults)
  const spacing: SpacingConfig | null =
    typeof display.spacing === 'string'
      ? JSON.parse(display.spacing)
      : (display.spacing as unknown as SpacingConfig) || null
  const space = getSpacingStyles(spacing)
  const containerStyle = getContainerStyle(spacing)

  // When tabs are enabled, PublicTabView is the entire page
  if (tabsConfig?.enabled && tabsConfig.tabs.length > 0) {
    return (
      <>
        <PageViewTracker displayId={display.id} />
        <PublicTabView
          tabs={tabsConfig.tabs}
          style={tabsConfig.style}
          alignment={tabsConfig.alignment}
          displayId={display.id}
          defaultHeaderCard={headerCard}
          defaultBackground={background}
          spacing={spacing}
        />
        {creatorChip}
      </>
    )
  }

  return (
    <div className="min-h-screen" style={backgroundStyles}>
      <PageViewTracker displayId={display.id} />
      <FontLoader sections={sections} />

      {/* Header Card */}
      {headerCard?.enabled && (
        <PublicHeaderCard config={headerCard} />
      )}

      <main style={{ paddingTop: `${space.paddingY}px`, paddingBottom: `${space.paddingY}px` }}>
        <div style={containerStyle}>
          {/* Default text header — only show if NO header card */}
          {!headerCard?.enabled && (
            <header className="mb-12 text-center">
              <h1 className="text-4xl font-bold mb-2">{display.title}</h1>
              {display.description && (
                <p className="text-lg opacity-70">{display.description}</p>
              )}
              <div className="mt-4 flex items-center justify-center gap-3">
                <a href={`/${user.username}`} className="text-sm opacity-50 hover:opacity-80 hover:underline">
                  by {user.name || user.username}
                </a>
              </div>
            </header>
          )}

          {/* Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: `${space.sectionGap}px` }}>
            {sections.map((section) => (
              <div
                key={section.id}
                className={`grid ${getGridClass(section.layout)}`}
                style={{ gap: `${space.columnGap}px` }}
              >
                {section.columns.map((column) => (
                  <div
                    key={column.id}
                    style={{ ...getColumnStyles(column), display: 'flex', flexDirection: 'column', gap: `${space.elementGap}px` }}
                  >
                    {column.elements.map((element) => (
                      <div key={element.id}>
                        {renderElement(element, display.id)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Empty State */}
          {sections.length === 0 && (
            <div className="text-center py-20 opacity-50">
              <p>This page is empty</p>
            </div>
          )}

          {/* Footer */}
          <footer className="mt-16 pt-8 border-t border-current/10 text-center">
            <p className="text-sm opacity-50">
              Made with{' '}
              <Link href="/" className="underline hover:opacity-80">
                My Galli
              </Link>
            </p>
          </footer>
        </div>
      </main>
      {creatorChip}
    </div>
  )
}
