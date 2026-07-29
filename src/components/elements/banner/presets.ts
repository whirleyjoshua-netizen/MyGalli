import type { BannerFillKind, BannerPreset } from '@/lib/types/canvas'

export interface PresetSpec {
  minHeight: number
  align: 'left' | 'center'
  headingClass: string
  subtextClass: string
  clipPath?: string
  borderRadius?: string
  accentBar?: boolean
}

export const BANNER_PRESETS: Record<BannerPreset, PresetSpec> = {
  // Heraldic
  ribbon: {
    minHeight: 72,
    align: 'center',
    headingClass: 'text-lg font-semibold tracking-tight',
    subtextClass: 'text-xs opacity-90',
    clipPath: 'polygon(0 0, 100% 0, calc(100% - 24px) 50%, 100% 100%, 0 100%, 24px 50%)',
  },
  pennant: {
    minHeight: 64,
    align: 'left',
    headingClass: 'text-base font-semibold tracking-tight',
    subtextClass: 'text-xs opacity-90',
    clipPath: 'polygon(0 0, 100% 0, calc(100% - 32px) 50%, 100% 100%, 0 100%)',
  },
  crest: {
    minHeight: 120,
    align: 'center',
    headingClass: 'text-xl font-semibold tracking-tight',
    subtextClass: 'text-sm opacity-90',
    borderRadius: '9999px 9999px 12px 12px',
  },
  // Announcement
  strip: {
    minHeight: 44,
    align: 'center',
    headingClass: 'text-sm font-medium',
    subtextClass: 'text-xs opacity-80',
  },
  notice: {
    minHeight: 56,
    align: 'left',
    headingClass: 'text-sm font-semibold',
    subtextClass: 'text-xs opacity-85',
    borderRadius: '8px',
    accentBar: true,
  },
  // Hero
  hero: {
    minHeight: 240,
    align: 'center',
    headingClass: 'text-3xl sm:text-4xl font-bold tracking-tight',
    subtextClass: 'text-base opacity-90',
  },
  band: {
    minHeight: 140,
    align: 'center',
    headingClass: 'text-2xl font-semibold tracking-tight',
    subtextClass: 'text-sm opacity-90',
  },
}

export const FILL_TOKENS: Record<string, { css: string; text: 'light' | 'dark' }> = {
  primary: { css: '#39D98A', text: 'dark' },
  anchor: { css: '#0F3D2E', text: 'light' },
  aqua: { css: '#1FB6FF', text: 'dark' },
  violet: { css: '#6C63FF', text: 'light' },
}

export const FILL_GRADIENTS: Record<string, string> = {
  'mint-aqua': 'linear-gradient(135deg, #39D98A 0%, #1FB6FF 100%)',
  'aqua-violet': 'linear-gradient(135deg, #1FB6FF 0%, #6C63FF 100%)',
  'anchor-mint': 'linear-gradient(135deg, #0F3D2E 0%, #39D98A 100%)',
}

export interface ResolvedFill {
  background: string
  scrim: boolean
  text: 'light' | 'dark'
}

/**
 * Text color is derived from the FILL, not the preset — a ribbon on mint and a
 * ribbon on anchor need different text. Gradients and images always get a scrim
 * plus light text, which is the only combination guaranteed readable over
 * arbitrary user imagery.
 */
export function resolveFill(kind: BannerFillKind | undefined, value: string | undefined): ResolvedFill {
  if (kind === 'gradient') {
    return {
      background: FILL_GRADIENTS[value ?? ''] ?? FILL_GRADIENTS['mint-aqua'],
      scrim: true,
      text: 'light',
    }
  }
  if (kind === 'image' && value) {
    return {
      background: `url("${value.replace(/"/g, '%22')}") center / cover no-repeat`,
      scrim: true,
      text: 'light',
    }
  }
  const token = FILL_TOKENS[value ?? ''] ?? FILL_TOKENS.primary
  return { background: token.css, scrim: false, text: token.text }
}
