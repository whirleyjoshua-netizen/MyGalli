'use client'

import type { CanvasElement } from '@/lib/types/canvas'
import { BannerShape } from './banner/BannerShape'

interface BannerElementProps {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const INLINE =
  'w-full bg-transparent border-none outline-none placeholder:opacity-60 text-inherit font-inherit'

export function BannerElement({ element, onChange, isSelected, onSelect }: BannerElementProps) {
  const centered = (element.bannerPreset ?? 'ribbon') !== 'pennant'
    && (element.bannerPreset ?? 'ribbon') !== 'notice'

  return (
    <div
      data-testid="banner-editor"
      onClick={onSelect}
      className={`relative rounded-lg transition-shadow ${isSelected ? 'ring-2 ring-primary' : ''}`}
    >
      <BannerShape
        preset={element.bannerPreset ?? 'ribbon'}
        fillKind={element.bannerFillKind}
        fillValue={element.bannerFillValue}
        linkLabel={element.bannerLinkLabel}
        linkUrl={element.bannerLinkUrl}
        headingNode={
          <input
            type="text"
            aria-label="Banner heading"
            className={INLINE}
            style={{ textAlign: centered ? 'center' : 'left' }}
            value={element.bannerHeading ?? ''}
            placeholder="Your headline"
            onChange={(e) => onChange({ bannerHeading: e.target.value })}
          />
        }
        subtextNode={
          <input
            type="text"
            aria-label="Banner subtext"
            className={INLINE}
            style={{ textAlign: centered ? 'center' : 'left' }}
            value={element.bannerSubtext ?? ''}
            placeholder="Optional supporting line"
            onChange={(e) => onChange({ bannerSubtext: e.target.value })}
          />
        }
      />
    </div>
  )
}
