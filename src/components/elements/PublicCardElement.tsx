'use client'

import type { CanvasElement } from '@/lib/types/canvas'
import { CARD_PROVIDERS } from '@/lib/cards/registry'
import { VouchCard } from './cards/VouchCard'
import { IframeCardRenderer } from './cards/IframeCardRenderer'

const CARD_RENDERERS: Record<string, React.ComponentType<{ data: Record<string, any>; style?: 'default' | 'compact' | 'detailed' }>> = {
  vouch: VouchCard,
}

interface PublicCardElementProps {
  element: CanvasElement
}

export function PublicCardElement({ element }: PublicCardElementProps) {
  const provider = element.cardProvider || 'vouch'
  const data = element.cardData || {}
  const style = element.cardStyle || 'default'

  const providerConfig = CARD_PROVIDERS[provider]

  // External cards render via sandboxed iframe
  if (providerConfig?.type === 'external' && providerConfig.iframeUrl) {
    return (
      <IframeCardRenderer
        url={providerConfig.iframeUrl}
        data={data}
        style={style}
      />
    )
  }

  const Renderer = CARD_RENDERERS[provider]

  if (!Renderer) {
    return (
      <div className="p-4 rounded-lg bg-muted/30 border border-border text-center text-sm text-muted-foreground">
        Unknown card provider: {provider}
      </div>
    )
  }

  return <Renderer data={data} style={style} />
}
