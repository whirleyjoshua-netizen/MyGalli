import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import type { Section } from '@/lib/types/canvas'
import type { BackgroundConfig } from '@/lib/types/background'
import { getBackgroundStyles, DEFAULT_BACKGROUND_CONFIG } from '@/lib/types/background'
import type { HeaderCardConfig } from '@/lib/types/header-card'
import type { TabsConfig } from '@/lib/types/tabs'
import { PageViewTracker } from '@/components/analytics/PageViewTracker'
import { renderElement, getGridClass, getColumnStyles } from '@/lib/render-elements'
import { PublicHeaderCard } from '@/components/header/PublicHeaderCard'
import { PublicTabView } from '@/components/tabs/PublicTabView'
import { FontLoader } from '@/components/FontLoader'

interface Props {
  params: Promise<{ code: string }>
}

export default async function ShareLinkPage({ params }: Props) {
  const { code } = await params

  // Look up share link
  const shareLink = await db.shareLink.findUnique({
    where: { code },
    include: {
      display: {
        include: {
          user: {
            select: { id: true, username: true, name: true, avatar: true },
          },
        },
      },
    },
  })

  if (!shareLink || !shareLink.isActive || !shareLink.display.published) {
    notFound()
  }

  // Increment clicks (fire-and-forget)
  db.shareLink.update({
    where: { id: shareLink.id },
    data: { clicks: { increment: 1 } },
  }).catch(() => {})

  const display = shareLink.display
  const user = display.user

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
        />
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

      <main className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Default text header — only show if NO header card */}
          {!headerCard?.enabled && (
            <header className="mb-12 text-center">
              <h1 className="text-4xl font-bold mb-2">{display.title}</h1>
              {display.description && (
                <p className="text-lg opacity-70">{display.description}</p>
              )}
              <p className="mt-4 text-sm opacity-50">
                by {user.name || user.username}
              </p>
            </header>
          )}

          {/* Sections */}
          <div className="space-y-8">
            {sections.map((section) => (
              <div
                key={section.id}
                className={`grid gap-6 ${getGridClass(section.layout)}`}
              >
                {section.columns.map((column) => (
                  <div
                    key={column.id}
                    className="space-y-4"
                    style={getColumnStyles(column)}
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
              <a href="/" className="underline hover:opacity-80">
                Gallio
              </a>
            </p>
          </footer>
        </div>
      </main>
    </div>
  )
}
