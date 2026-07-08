'use client'

import { useState } from 'react'
import { Trash2, Plus, Loader2, ShoppingBag, ChevronUp, ChevronDown, ImagePlus } from 'lucide-react'
import type { CanvasElement, Product } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

function newId() { return `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

export function ProductListElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const products: Product[] = element.products ?? []
  const [url, setUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  const set = (next: Product[]) => onChange({ products: next })
  const update = (id: string, patch: Partial<Product>) => set(products.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const remove = (id: string) => set(products.filter((p) => p.id !== id))
  const move = (id: string, dir: -1 | 1) => {
    const i = products.findIndex((p) => p.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= products.length) return
    const next = [...products]
    ;[next[i], next[j]] = [next[j], next[i]]
    set(next)
  }

  async function addByUrl() {
    const buyUrl = url.trim()
    if (!buyUrl) return
    setFetching(true)
    const product: Product = { id: newId(), title: '', buyUrl }
    try {
      const res = await fetch('/api/link-preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: buyUrl }),
      })
      if (res.ok) {
        const d = await res.json()
        product.title = d.title || ''
        product.price = d.price || undefined
        product.description = d.description || undefined
        product.imageUrl = d.imageUrl || undefined
      }
    } catch { /* fall through to a blank editable card */ }
    finally {
      if (!product.title) product.title = 'New product'
      set([...products, product])
      setUrl('')
      setFetching(false)
    }
  }

  async function replaceImage(id: string, file: File) {
    setUploadingId(id)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) { const d = await res.json(); update(id, { imageUrl: d.url }) }
    } finally { setUploadingId(null) }
  }

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${isSelected ? 'ring-2 ring-primary border-primary/30' : 'border-border hover:border-primary/30'}`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="absolute -top-2 -right-2 z-10 p-1 rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 transition" title="Delete element">
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ShoppingBag className="w-4 h-4" /> Product List
        </div>

        <input
          value={element.productListTitle ?? ''}
          onChange={(e) => onChange({ productListTitle: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="List title (optional)"
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {/* Add by URL */}
        <div className="flex gap-1.5">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addByUrl() } }}
            placeholder="Paste a product link to auto-fill…"
            className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); addByUrl() }}
            disabled={fetching || !url.trim()}
            className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            {fetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add
          </button>
        </div>

        {/* Product rows */}
        <div className="space-y-2">
          {products.map((p, i) => (
            <div key={p.id} className="flex gap-2 rounded-lg border border-border p-2" onClick={(e) => e.stopPropagation()}>
              <label className="w-16 h-16 shrink-0 rounded-md bg-muted/40 border border-border flex items-center justify-center overflow-hidden cursor-pointer relative">
                {uploadingId === p.id ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  : p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : <ImagePlus className="w-5 h-5 text-muted-foreground" />}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceImage(p.id, f) }} />
              </label>
              <div className="flex-1 min-w-0 space-y-1.5">
                <input value={p.title} onChange={(e) => update(p.id, { title: e.target.value })} placeholder="Title" className="w-full px-2 py-1 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                <div className="flex gap-1.5">
                  <input value={p.price ?? ''} onChange={(e) => update(p.id, { price: e.target.value })} placeholder="Price" className="w-24 px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input value={p.buyUrl} onChange={(e) => update(p.id, { buyUrl: e.target.value })} placeholder="Buy link (https://…)" className="flex-1 min-w-0 px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <input value={p.description ?? ''} onChange={(e) => update(p.id, { description: e.target.value })} placeholder="Short description (optional)" className="w-full px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <button type="button" onClick={() => move(p.id, -1)} disabled={i === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30" title="Move up"><ChevronUp className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => move(p.id, 1)} disabled={i === products.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30" title="Move down"><ChevronDown className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => remove(p.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive" title="Remove product"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
          {products.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Add your first product above.</p>}
        </div>
      </div>
    </div>
  )
}
