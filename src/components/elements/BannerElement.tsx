'use client'

import type { CanvasElement } from '@/lib/types/canvas'
import { BannerShape } from './banner/BannerShape'
import { BANNER_PRESETS } from './banner/presets'

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
  const preset = element.bannerPreset ?? 'ribbon'
  const spec = BANNER_PRESETS[preset] ?? BANNER_PRESETS.ribbon
  const isCentered = spec.align === 'center'
  const hasSubtext = Boolean(element.bannerSubtext)

  return (
    <div
      data-testid="banner-editor"
      onClick={onSelect}
      className={`relative rounded-lg transition-shadow ${isSelected ? 'ring-2 ring-primary' : ''}`}
    >
      <BannerShape
        preset={preset}
        fillKind={element.bannerFillKind}
        fillValue={element.bannerFillValue}
        linkLabel={element.bannerLinkLabel}
        linkUrl={element.bannerLinkUrl}
        interactive={false}
        headingNode={
          <input
            type="text"
            aria-label="Banner heading"
            className={INLINE}
            style={{ textAlign: isCentered ? 'center' : 'left' }}
            value={element.bannerHeading ?? ''}
            placeholder="Your headline"
            onChange={(e) => onChange({ bannerHeading: e.target.value })}
          />
        }
        subtextNode={
          (hasSubtext || isSelected) ? (
            <input
              type="text"
              aria-label="Banner subtext"
              className={INLINE}
              style={{ textAlign: isCentered ? 'center' : 'left' }}
              value={element.bannerSubtext ?? ''}
              placeholder="Optional supporting line"
              onChange={(e) => onChange({ bannerSubtext: e.target.value })}
            />
          ) : undefined
        }
      />
    </div>
  )
}
