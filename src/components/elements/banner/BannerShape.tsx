'use client'

import type { ReactNode } from 'react'
import type { BannerFillKind, BannerPreset } from '@/lib/types/canvas'
import { safeHref } from '@/lib/editor/safe-href'
import { BANNER_PRESETS, resolveFill } from './presets'

export interface BannerShapeProps {
  preset: BannerPreset
  heading?: string
  subtext?: string
  fillKind?: BannerFillKind
  fillValue?: string
  linkLabel?: string
  linkUrl?: string
  headingNode?: ReactNode
  subtextNode?: ReactNode
}

export function BannerShape({
  preset,
  heading,
  subtext,
  fillKind,
  fillValue,
  linkLabel,
  linkUrl,
  headingNode,
  subtextNode,
}: BannerShapeProps) {
  const spec = BANNER_PRESETS[preset] ?? BANNER_PRESETS.ribbon
  const fill = resolveFill(fillKind, fillValue)
  const href = safeHref(linkUrl)
  const showLink = Boolean(linkLabel && href)

  const textColor = fill.text === 'light' ? '#FFFFFF' : '#0F3D2E'
  const padX = spec.clipPath ? 48 : 24

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        minHeight: spec.minHeight,
        background: fill.background,
        clipPath: spec.clipPath,
        borderRadius: spec.borderRadius,
        color: textColor,
      }}
    >
      {fill.scrim && (
        <div
          data-banner-scrim
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'rgba(15,61,46,0.5)' }}
        />
      )}

      {spec.accentBar && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: textColor, opacity: 0.6 }}
        />
      )}

      <div
        className="relative flex h-full flex-col justify-center gap-1"
        style={{
          minHeight: spec.minHeight,
          padding: `12px ${padX}px`,
          alignItems: spec.align === 'center' ? 'center' : 'flex-start',
          textAlign: spec.align,
        }}
      >
        <div className={spec.headingClass}>{headingNode ?? heading}</div>

        {(subtextNode || subtext) && (
          <div className={spec.subtextClass}>{subtextNode ?? subtext}</div>
        )}

        {showLink && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block rounded-full px-4 py-1.5 text-xs font-semibold transition-opacity hover:opacity-85"
            style={{ background: textColor, color: fill.text === 'light' ? '#0F3D2E' : '#FFFFFF' }}
          >
            {linkLabel}
          </a>
        )}
      </div>
    </div>
  )
}
