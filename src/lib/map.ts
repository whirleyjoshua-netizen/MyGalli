import type { MapPlace, MapCategory } from '@/lib/types/canvas'

const DEFAULT_CATEGORY: MapCategory = { key: '', label: '', color: '#39D98A' }

export const TILE_STYLES: Record<'light' | 'standard' | 'terrain', { url: string; attribution: string; subdomains?: string }> = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    attribution: '&copy; OpenStreetMap contributors',
  },
  terrain: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
}

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function isFiniteCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

export function isSafePhotoUrl(url: string | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function buildDirectionsUrl(place: Pick<MapPlace, 'lat' | 'lng'>): string | null {
  if (!isFiniteCoord(place.lat) || !isFiniteCoord(place.lng)) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.lat},${place.lng}`)}`
}

export function resolveCategory(place: MapPlace, categories: MapCategory[]): MapCategory {
  return categories.find((c) => c.key === place.category) ?? DEFAULT_CATEGORY
}

export function markerVariant(place: MapPlace): 'photo' | 'plain' {
  return isSafePhotoUrl(place.photo) ? 'photo' : 'plain'
}

export function markerDivHtml(place: MapPlace, category: MapCategory): string {
  const label = escapeHtml(place.label || '')
  const color = escapeHtml(category.color || '#39D98A')
  if (markerVariant(place) === 'photo') {
    const bg = encodeURI(place.photo as string).replace(/'/g, '%27')
    return (
      `<span class="galli-pin galli-pin--photo" title="${label}" role="img" aria-label="${label}" ` +
      `style="--pin-color:${color};background-image:url('${bg}')"></span>`
    )
  }
  const glyph = category.emoji ? `<span class="galli-pin__emoji">${escapeHtml(category.emoji)}</span>` : ''
  return `<span class="galli-pin galli-pin--plain" title="${label}" role="img" aria-label="${label}" style="--pin-color:${color}">${glyph}</span>`
}

export function popupHtml(place: MapPlace, category: MapCategory): string {
  const label = escapeHtml(place.label || 'Untitled')
  const photo = markerVariant(place) === 'photo'
    ? `<div class="galli-pop__photo"><img src="${encodeURI(place.photo as string)}" alt="${label}" /></div>`
    : ''
  const date = place.date ? `<div class="galli-pop__date">${escapeHtml(place.date)}</div>` : ''
  const note = place.note ? `<p class="galli-pop__note">${escapeHtml(place.note)}</p>` : ''
  const dir = place.directions ? buildDirectionsUrl(place) : null
  const button = dir
    ? `<a class="galli-pop__dir" href="${dir}" target="_blank" rel="noopener noreferrer">Get directions</a>`
    : ''
  const dot = `<span class="galli-pop__dot" style="background:${escapeHtml(category.color || '#39D98A')}"></span>`
  return (
    `<div class="galli-pop">${photo}<div class="galli-pop__body">` +
    `<div class="galli-pop__title">${dot}${label}</div>${date}${note}${button}` +
    `</div></div>`
  )
}

export function mapNominatimResult(item: unknown): { lat: number; lng: number; label: string; address: string } | null {
  if (!item || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  const lat = Number(o.lat)
  const lng = Number(o.lon)
  if (!isFiniteCoord(lat) || !isFiniteCoord(lng)) return null
  const address = typeof o.display_name === 'string' ? o.display_name : ''
  const label = address.split(',')[0]?.trim() || 'Pinned place'
  return { lat, lng, label, address }
}

export function visiblePlaces(places: MapPlace[], activeKey: string | null): MapPlace[] {
  if (activeKey === null) return places
  return places.filter((p) => p.category === activeKey)
}
