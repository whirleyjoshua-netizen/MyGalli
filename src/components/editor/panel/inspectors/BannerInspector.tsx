'use client'

import type { BannerFillKind, BannerPreset } from '@/lib/types/canvas'
import type { InspectorProps } from './DefaultInspector'
import { FILL_GRADIENTS, FILL_TOKENS } from '@/components/elements/banner/presets'

const FIELD =
  'mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary'

const PRESET_GROUPS: { label: string; options: { value: string; label: string }[] }[] = [
  { label: 'Heraldic', options: [
    { value: 'ribbon', label: 'Ribbon' },
    { value: 'pennant', label: 'Pennant' },
    { value: 'crest', label: 'Crest' },
  ] },
  { label: 'Announcement', options: [
    { value: 'strip', label: 'Strip' },
    { value: 'notice', label: 'Notice' },
  ] },
  { label: 'Hero', options: [
    { value: 'hero', label: 'Hero' },
    { value: 'band', label: 'Band' },
  ] },
]

/** Switching fill kind must replace the value — a gradient name left in an image slot renders nothing. */
const DEFAULT_FILL_VALUE: Record<BannerFillKind, string> = {
  token: 'primary',
  gradient: 'mint-aqua',
  image: '',
}

export function BannerInspector({ element, onChange }: InspectorProps) {
  const fillKind = (element.bannerFillKind ?? 'token') as BannerFillKind

  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Style
        <select
          className={FIELD}
          value={element.bannerPreset ?? 'ribbon'}
          onChange={(e) => onChange({ bannerPreset: e.target.value as BannerPreset })}
        >
          {PRESET_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="block text-xs text-muted-foreground">
        Fill type
        <select
          className={FIELD}
          value={fillKind}
          onChange={(e) => {
            const kind = e.target.value as BannerFillKind
            onChange({ bannerFillKind: kind, bannerFillValue: DEFAULT_FILL_VALUE[kind] })
          }}
        >
          <option value="token">Brand color</option>
          <option value="gradient">Gradient</option>
          <option value="image">Image</option>
        </select>
      </label>

      {fillKind === 'token' && (
        <label className="block text-xs text-muted-foreground">
          Brand color
          <select
            className={FIELD}
            value={element.bannerFillValue ?? 'primary'}
            onChange={(e) => onChange({ bannerFillValue: e.target.value })}
          >
            {Object.keys(FILL_TOKENS).map((k) => (
              <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>
            ))}
          </select>
        </label>
      )}

      {fillKind === 'gradient' && (
        <label className="block text-xs text-muted-foreground">
          Gradient
          <select
            className={FIELD}
            value={element.bannerFillValue ?? 'mint-aqua'}
            onChange={(e) => onChange({ bannerFillValue: e.target.value })}
          >
            {Object.keys(FILL_GRADIENTS).map((k) => (
              <option key={k} value={k}>{k.replace('-', ' → ')}</option>
            ))}
          </select>
        </label>
      )}

      {fillKind === 'image' && (
        <label className="block text-xs text-muted-foreground">
          Image URL
          <input
            type="text"
            className={FIELD}
            placeholder="https://…"
            value={element.bannerFillValue ?? ''}
            onChange={(e) => onChange({ bannerFillValue: e.target.value })}
          />
          <span className="mt-1 block text-[11px] text-muted-foreground/70">
            Works best with uploaded images or Unsplash URLs. Other hosts may be blocked by the
            browser and show an empty banner.
          </span>
        </label>
      )}

      <label className="block text-xs text-muted-foreground">
        Heading
        <input
          type="text"
          className={FIELD}
          placeholder="Your headline"
          value={element.bannerHeading ?? ''}
          onChange={(e) => onChange({ bannerHeading: e.target.value })}
        />
      </label>

      <label className="block text-xs text-muted-foreground">
        Subtext
        <input
          type="text"
          className={FIELD}
          placeholder="Optional supporting line"
          value={element.bannerSubtext ?? ''}
          onChange={(e) => onChange({ bannerSubtext: e.target.value })}
        />
      </label>

      <label className="block text-xs text-muted-foreground">
        Button label
        <input
          type="text"
          className={FIELD}
          placeholder="Leave blank for no button"
          value={element.bannerLinkLabel ?? ''}
          onChange={(e) => onChange({ bannerLinkLabel: e.target.value })}
        />
      </label>

      <label className="block text-xs text-muted-foreground">
        Button link
        <input
          type="text"
          className={FIELD}
          placeholder="https://…"
          value={element.bannerLinkUrl ?? ''}
          onChange={(e) => onChange({ bannerLinkUrl: e.target.value })}
        />
      </label>

      <p className="text-[11px] text-muted-foreground/70 border-t border-border pt-2">
        Height, alignment and text color come from the style you pick. Image and gradient fills
        get a scrim so text stays readable.
      </p>
    </div>
  )
}
