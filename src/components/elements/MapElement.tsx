'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import './map-element.css'
import { Trash2, MapPin, Search, Loader2, Upload, GripVertical, Navigation } from 'lucide-react'
import type { CanvasElement, MapPlace, MapCategory } from '@/lib/types/canvas'
import { TILE_STYLES, markerDivHtml, resolveCategory, mapNominatimResult, isFiniteCoord } from '@/lib/map'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const uid = () => `mp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export function MapElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const places = element.mapPlaces ?? []
  const categories = element.mapCategories ?? []
  const tile = TILE_STYLES[element.mapTileStyle ?? 'light']

  const mapRef = useRef<HTMLDivElement>(null)
  const mapObj = useRef<import('leaflet').Map | null>(null)
  const layerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const placesRef = useRef(places)
  placesRef.current = places

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  const updatePlace = (id: string, patch: Partial<MapPlace>) =>
    onChange({ mapPlaces: places.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  const removePlace = (id: string) => onChange({ mapPlaces: places.filter((p) => p.id !== id) })
  const addPlace = (p: MapPlace) => onChange({ mapPlaces: [...placesRef.current, p] })

  // Build the editor map once.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapRef.current || mapObj.current) return
      const map = L.map(mapRef.current, { scrollWheelZoom: false }).setView([20, 0], 2)
      L.tileLayer(tile.url, { attribution: tile.attribution, subdomains: tile.subdomains ?? 'abc', maxZoom: 19 }).addTo(map)
      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        addPlace({ id: uid(), label: 'New place', lat: e.latlng.lat, lng: e.latlng.lng, category: categories[0]?.key })
      })
      layerRef.current = L.layerGroup().addTo(map)
      mapObj.current = map
    })()
    return () => { cancelled = true; mapObj.current?.remove(); mapObj.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render markers when places/categories change.
  useEffect(() => {
    ;(async () => {
      const L = (await import('leaflet')).default
      const layer = layerRef.current
      if (!layer) return
      layer.clearLayers()
      for (const p of places) {
        if (!isFiniteCoord(p.lat) || !isFiniteCoord(p.lng)) continue
        const cat = resolveCategory(p, categories)
        const icon = L.divIcon({ html: markerDivHtml(p, cat), className: 'galli-pin-wrap', iconSize: [44, 44], iconAnchor: [22, 22] })
        const marker = L.marker([p.lat, p.lng], { icon, draggable: true })
        marker.on('dragend', () => { const ll = marker.getLatLng(); updatePlace(p.id, { lat: ll.lat, lng: ll.lng }) })
        layer.addLayer(marker)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, categories])

  const search = async () => {
    if (!query.trim()) return
    setSearching(true); setSearchError(null)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, {
        headers: { 'Accept-Language': 'en' },
      })
      const json = await res.json()
      const mapped = Array.isArray(json) ? mapNominatimResult(json[0]) : null
      if (!mapped) { setSearchError("Couldn't find that address — try dropping a pin on the map."); return }
      addPlace({ id: uid(), label: mapped.label, lat: mapped.lat, lng: mapped.lng, address: mapped.address, category: categories[0]?.key })
      mapObj.current?.setView([mapped.lat, mapped.lng], 11)
      setQuery('')
    } catch {
      setSearchError("Search failed — try dropping a pin on the map.")
    } finally {
      setSearching(false)
    }
  }

  const uploadPhoto = async (id: string, file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) return
    setUploadingId(id)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) { const data = await res.json(); updatePlace(id, { photo: data.url }) }
    } finally { setUploadingId(null) }
  }

  const addCategory = () =>
    onChange({ mapCategories: [...categories, { key: uid(), label: 'New category', color: '#1FB6FF' }] })
  const updateCategory = (key: string, patch: Partial<MapCategory>) =>
    onChange({ mapCategories: categories.map((c) => (c.key === key ? { ...c, ...patch } : c)) })
  const removeCategory = (key: string) =>
    onChange({ mapCategories: categories.filter((c) => c.key !== key) })

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${isSelected ? 'ring-2 ring-galli border-galli/30' : 'border-border hover:border-galli/30'}`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-galli" />
          <input
            type="text" value={element.mapTitle ?? ''} placeholder="Map title"
            onChange={(e) => onChange({ mapTitle: e.target.value })}
            className="text-sm font-semibold bg-transparent border-none outline-none flex-1"
          />
          <select
            value={element.mapTileStyle ?? 'light'}
            onChange={(e) => onChange({ mapTileStyle: e.target.value as 'light' | 'standard' | 'terrain' })}
            className="text-xs bg-muted border border-border rounded px-2 py-1 outline-none"
          >
            <option value="light">Light</option>
            <option value="standard">Standard</option>
            <option value="terrain">Terrain</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={element.mapConnectLine ?? false} onChange={(e) => onChange({ mapConnectLine: e.target.checked })} />
          Connect pins with a journey line
        </label>

        {/* Add place: search */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 border border-border rounded-lg px-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text" value={query} placeholder="Search an address or place"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }}
              className="flex-1 text-xs bg-transparent py-1.5 outline-none"
            />
          </div>
          <button onClick={search} disabled={searching} className="px-3 rounded-lg bg-galli text-white text-xs font-medium disabled:opacity-60">
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
          </button>
        </div>
        {searchError && <p className="text-xs text-destructive">{searchError}</p>}
        <p className="text-[11px] text-muted-foreground">Or click the map to drop a pin, and drag any pin to adjust.</p>

        {/* Editor map */}
        <div ref={mapRef} className="galli-map w-full rounded-[16px] ring-1 ring-black/5 bg-[#eef2f0]" style={{ height: 260 }} />

        {/* Places list */}
        <div className="space-y-2">
          {places.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-white p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                <input
                  type="text" value={p.label} placeholder="Label"
                  onChange={(e) => updatePlace(p.id, { label: e.target.value })}
                  className="flex-1 text-sm font-medium bg-transparent outline-none"
                />
                <button aria-label="Remove place" onClick={() => removePlace(p.id)} className="p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {p.address && <p className="text-[11px] text-muted-foreground truncate pl-6">{p.address}</p>}
              <div className="grid grid-cols-2 gap-2 pl-6">
                <input type="text" value={p.note ?? ''} placeholder="Note" onChange={(e) => updatePlace(p.id, { note: e.target.value })} className="text-xs border border-border rounded px-2 py-1 outline-none" />
                <input type="text" value={p.date ?? ''} placeholder="Date (e.g. 2024)" onChange={(e) => updatePlace(p.id, { date: e.target.value })} className="text-xs border border-border rounded px-2 py-1 outline-none" />
                <select value={p.category ?? ''} onChange={(e) => updatePlace(p.id, { category: e.target.value || undefined })} className="text-xs border border-border rounded px-2 py-1 outline-none">
                  <option value="">No category</option>
                  {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
                <label className="text-xs border border-border rounded px-2 py-1 flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-galli">
                  {uploadingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {p.photo ? 'Change photo' : 'Photo'}
                  <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(p.id, f); e.target.value = '' }} />
                </label>
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground pl-6">
                <input type="checkbox" checked={p.directions ?? false} onChange={(e) => updatePlace(p.id, { directions: e.target.checked })} />
                <Navigation className="w-3 h-3" /> Show &ldquo;Get directions&rdquo; button
              </label>
            </div>
          ))}
        </div>

        {/* Category manager */}
        <div className="border-t border-border pt-2 space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground">Categories</p>
          {categories.map((c) => (
            <div key={c.key} className="flex items-center gap-2">
              <input aria-label="Category color" type="color" value={c.color} onChange={(e) => updateCategory(c.key, { color: e.target.value })} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent" />
              <input type="text" value={c.label} onChange={(e) => updateCategory(c.key, { label: e.target.value })} className="flex-1 text-xs border border-border rounded px-2 py-1 outline-none" />
              <input type="text" value={c.emoji ?? ''} placeholder="😀" maxLength={2} onChange={(e) => updateCategory(c.key, { emoji: e.target.value || undefined })} className="w-10 text-xs border border-border rounded px-2 py-1 outline-none text-center" />
              <button aria-label="Remove category" onClick={() => removeCategory(c.key)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button onClick={addCategory} className="text-xs text-galli font-medium">+ Add category</button>
        </div>
      </div>

      {isSelected && (
        <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground transition">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
