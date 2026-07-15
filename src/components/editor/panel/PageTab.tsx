'use client'

import type { BackgroundConfig } from '@/lib/types/background'
import type { SpacingConfig } from '@/lib/types/spacing'
import type { HeaderCardConfig } from '@/lib/types/header-card'
import type { TabsConfig } from '@/lib/types/tabs'
import type { Section } from '@/lib/types/canvas'
import { BackgroundSettingsBody } from '@/components/canvas/BackgroundSettings'
import { SpacingSettingsBody } from '@/components/canvas/SpacingSettings'
import { HeaderCardEditorBody } from '@/components/header/HeaderCardEditor'
import { TabEditorBody } from '@/components/tabs/TabEditor'
import { LastUpdatedSettingsBody } from './LastUpdatedSettings'

interface PageTabProps {
  background: BackgroundConfig; onBackgroundChange: (c: BackgroundConfig) => void
  spacing: SpacingConfig; onSpacingChange: (c: SpacingConfig) => void
  headerCard: HeaderCardConfig; onHeaderCardChange: (c: HeaderCardConfig) => void
  tabsConfig: TabsConfig; onTabsChange: (c: TabsConfig) => void
  currentSections: Section[]
  showLastUpdated: boolean; onShowLastUpdatedChange: (next: boolean) => void
}

function Section_({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="border-b border-border group">
      <summary className="px-3 py-2.5 text-sm font-medium cursor-pointer select-none list-none flex items-center justify-between hover:bg-muted/50 transition">
        {title}
        <span className="text-muted-foreground text-xs group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  )
}

export function PageTab(props: PageTabProps) {
  return (
    <div>
      <Section_ title="Background" defaultOpen>
        <BackgroundSettingsBody config={props.background} onChange={props.onBackgroundChange} />
      </Section_>
      <Section_ title="Spacing & layout">
        <SpacingSettingsBody config={props.spacing} onChange={props.onSpacingChange} />
      </Section_>
      <Section_ title="Header card">
        <HeaderCardEditorBody config={props.headerCard} onChange={props.onHeaderCardChange} />
      </Section_>
      <Section_ title="Tabs">
        <TabEditorBody config={props.tabsConfig} onChange={props.onTabsChange} currentSections={props.currentSections} />
      </Section_>
      <Section_ title="Last updated">
        <LastUpdatedSettingsBody
          value={props.showLastUpdated}
          onChange={props.onShowLastUpdatedChange}
        />
      </Section_>
    </div>
  )
}
