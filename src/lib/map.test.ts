import { describe, it, expect } from 'vitest'
import {
  escapeHtml, isSafePhotoUrl, buildDirectionsUrl, resolveCategory, markerVariant,
  markerDivHtml, popupHtml, mapNominatimResult, visiblePlaces, TILE_STYLES,
} from './map'
import type { MapPlace, MapCategory } from '@/lib/types/canvas'

const cats: MapCategory[] = [{ key: 'lived', label: 'Lived', color: '#6C63FF' }]
const place = (o: Partial<MapPlace> = {}): MapPlace => ({ id: 'p1', label: 'Lisbon', lat: 38.7, lng: -9.1, ...o })

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;')
  })
})

describe('isSafePhotoUrl', () => {
  it('accepts http(s), rejects everything else', () => {
    expect(isSafePhotoUrl('https://x.blob/a.png')).toBe(true)
    expect(isSafePhotoUrl('javascript:alert(1)')).toBe(false)
    expect(isSafePhotoUrl(undefined)).toBe(false)
  })
})

describe('buildDirectionsUrl', () => {
  it('builds a Google Maps deep-link', () => {
    expect(buildDirectionsUrl({ lat: 38.7, lng: -9.1 }))
      .toBe('https://www.google.com/maps/dir/?api=1&destination=38.7%2C-9.1')
  })
  it('returns null for non-finite coords', () => {
    expect(buildDirectionsUrl({ lat: NaN, lng: 0 })).toBeNull()
  })
})

describe('resolveCategory', () => {
  it('matches by key', () => {
    expect(resolveCategory(place({ category: 'lived' }), cats).color).toBe('#6C63FF')
  })
  it('falls back to a green default when unmatched', () => {
    expect(resolveCategory(place({ category: 'nope' }), cats).color).toBe('#39D98A')
  })
})

describe('markerVariant', () => {
  it('is photo when a safe photo url is present, else plain', () => {
    expect(markerVariant(place({ photo: 'https://x/a.png' }))).toBe('photo')
    expect(markerVariant(place())).toBe('plain')
    expect(markerVariant(place({ photo: 'javascript:x' }))).toBe('plain')
  })
})

describe('markerDivHtml', () => {
  it('escapes the label into the aria/title and includes the category color', () => {
    const html = markerDivHtml(place({ label: '<x>' }), cats[0])
    expect(html).toContain('#6C63FF')
    expect(html).toContain('&lt;x&gt;')
    expect(html).not.toContain('<x>')
  })
})

describe('popupHtml', () => {
  it('escapes note/label and renders a safe directions link when enabled', () => {
    const html = popupHtml(place({ label: 'A&B', note: '<script>', directions: true }), cats[0])
    expect(html).toContain('A&amp;B')
    expect(html).not.toContain('<script>')
    expect(html).toContain('https://www.google.com/maps/dir/?api=1&destination=38.7%2C-9.1')
    expect(html).toContain('rel="noopener noreferrer"')
  })
  it('omits the directions link when not enabled', () => {
    expect(popupHtml(place({ directions: false }), cats[0])).not.toContain('maps/dir')
  })
})

describe('mapNominatimResult', () => {
  it('maps a valid item', () => {
    const r = mapNominatimResult({ lat: '38.7', lon: '-9.1', display_name: 'Lisbon, Portugal' })
    expect(r).toEqual({ lat: 38.7, lng: -9.1, label: 'Lisbon', address: 'Lisbon, Portugal' })
  })
  it('returns null for non-finite/malformed items', () => {
    expect(mapNominatimResult({ lat: 'x', lon: '1', display_name: 'q' })).toBeNull()
    expect(mapNominatimResult(null)).toBeNull()
  })
})

describe('visiblePlaces', () => {
  it('returns all when activeKey is null', () => {
    const ps = [place({ category: 'lived' }), place({ id: 'p2', category: 'seen' })]
    expect(visiblePlaces(ps, null)).toHaveLength(2)
    expect(visiblePlaces(ps, 'lived')).toHaveLength(1)
  })
})

describe('TILE_STYLES', () => {
  it('has all three styles with url + attribution', () => {
    for (const k of ['light', 'standard', 'terrain'] as const) {
      expect(TILE_STYLES[k].url).toMatch(/^https:\/\//)
      expect(TILE_STYLES[k].attribution).toContain('OpenStreetMap')
    }
  })
})
