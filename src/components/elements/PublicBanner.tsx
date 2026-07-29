'use client'

import type { CanvasElement } from '@/lib/types/canvas'
import { BannerShape } from './banner/BannerShape'

export function PublicBanner({ element }: { element: CanvasElement }) {
  return (
    <BannerShape
      preset={element.bannerPreset ?? 'ribbon'}
      heading={element.bannerHeading}
      subtext={element.bannerSubtext}
      fillKind={element.bannerFillKind}
      fillValue={element.bannerFillValue}
      linkLabel={element.bannerLinkLabel}
      linkUrl={element.bannerLinkUrl}
    />
  )
}
