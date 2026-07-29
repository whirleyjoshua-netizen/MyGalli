'use client'

import { Trash2 } from 'lucide-react'
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

export function BannerElement({ element, onChange, onDelete, isSelected, onSelect }: BannerElementProps) {
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

      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
