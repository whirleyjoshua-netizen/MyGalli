'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import './map-element.css'
import type { CanvasElement, MapPlace, MapCategory } from '@/lib/types/canvas'
import {
  TILE_STYLES, markerDivHtml, popupHtml, resolveCategory, visiblePlaces, isFiniteCoord,
} from '@/lib/map'

function validPlaces(places: MapPlace[]): MapPlace[] {
  return places.filter((p) => isFiniteCoord(p.lat) && isFiniteCoord(p.lng))
}

function renderMarkers(
  L: typeof import('leaflet'),
  map: import('leaflet').Map,
  layer: import('leaflet').LayerGroup,
  places: MapPlace[],
  categories: MapCategory[],
  element: CanvasElement,
) {
  layer.clearLayers()
  const latlngs: [number, number][] = []
  for (const p of places) {
    const cat = resolveCategory(p, categories)
    const icon = L.divIcon({
      html: markerDivHtml(p, cat),
      className: 'galli-pin-wrap',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -20],
    })
    L.marker([p.lat, p.lng], { icon, keyboard: true, title: p.label })
      .bindPopup(popupHtml(p, cat), { closeButton: true })
      .addTo(layer)
    latlngs.push([p.lat, p.lng])
  }

  if (element.mapConnectLine && latlngs.length > 1) {
    L.polyline(latlngs, { color: '#0F3D2E', weight: 3, opacity: 0.65, lineJoin: 'round', className: 'galli-journey' }).addTo(layer)
  }

  if (latlngs.length === 1) {
    map.setView(latlngs[0], 12)
  } else if (latlngs.length > 1 && (element.mapFitView ?? true)) {
    map.fitBounds(latlngs, { padding: [40, 40] })
  } else if (latlngs.length > 1) {
    map.setView(latlngs[0], 4)
  } else {
    map.setView([20, 0], 2)
  }
}

function MapView({ element, active }: { element: CanvasElement; active: string | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const height = element.mapHeight ?? 420
  const places = useMemo(
    () => visiblePlaces(validPlaces(element.mapPlaces ?? []), active),
    [element.mapPlaces, active],
  )
  const categories = element.mapCategories ?? []
  const tile = TILE_STYLES[element.mapTileStyle ?? 'light']

  const mapObj = useRef<import('leaflet').Map | null>(null)
  const layerRef = useRef<import('leaflet').LayerGroup | null>(null)

  // Build the map once (mount-only).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !ref.current || mapObj.current) return
      try {
        const map = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true })
        L.tileLayer(tile.url, { attribution: tile.attribution, subdomains: tile.subdomains ?? 'abc', maxZoom: 19 }).addTo(map)
        const layer = L.layerGroup().addTo(map)
        mapObj.current = map
        layerRef.current = layer
        renderMarkers(L, map, layer, places, categories, element)
      } catch {
        /* jsdom/no-layout — leave the skeleton div in place */
      }
    })()
    return () => { cancelled = true; mapObj.current?.remove(); mapObj.current = null; layerRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render markers/line/view when data changes.
  useEffect(() => {
    ;(async () => {
      const L = (await import('leaflet')).default
      const map = mapObj.current
      const layer = layerRef.current
      if (!map || !layer) return
      try {
        renderMarkers(L, map, layer, places, categories, element)
      } catch {
        /* jsdom/no-layout */
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, categories, element.mapConnectLine, element.mapFitView])

  return <div ref={ref} className="galli-map w-full rounded-[20px] ring-1 ring-black/5 shadow-soft bg-[#eef2f0]" style={{ height }} />
}

export function PublicMapElement({ element }: { element: CanvasElement }) {
  const places = validPlaces(element.mapPlaces ?? [])
  const categories = element.mapCategories ?? []
  const [active, setActive] = useState<string | null>(null)

  if (places.length === 0) return null

  const usedKeys = new Set(places.map((p) => p.category).filter(Boolean) as string[])
  const legend = categories.filter((c) => usedKeys.has(c.key))
  const showLegend = legend.length >= 2

  const chip = (key: string | null, label: string, color?: string) => {
    const on = active === key
    return (
      <button
        key={key ?? 'all'}
        onClick={() => setActive(key)}
        className={`h-9 shrink-0 rounded-full px-3 text-sm cursor-pointer transition-colors border ${
          on ? 'border-transparent' : 'border-gray-200 bg-surface text-slate-600 hover:bg-gray-50'
        }`}
        style={on ? { background: `${color ?? '#39D98A'}1f`, color: color ?? '#0F3D2E', borderColor: color ?? '#39D98A' } : undefined}
      >
        {color && <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: color }} />}
        {label}
      </button>
    )
  }

  return (
    <div className="space-y-3">
      {element.mapTitle && <h3 className="text-lg font-semibold text-galli-anchor">{element.mapTitle}</h3>}
      {showLegend && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {chip(null, 'All', '#39D98A')}
          {legend.map((c) => chip(c.key, c.label, c.color))}
        </div>
      )}
      <MapView element={element} active={active} />
    </div>
  )
}
