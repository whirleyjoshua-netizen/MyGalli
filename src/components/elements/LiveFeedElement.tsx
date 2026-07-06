'use client'

import { useState } from 'react'
import { Radio, Trash2, Smartphone, Copy, Check } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const PRESETS = [
  { id: 'single', label: 'Single counter' },
  { id: 'versus', label: 'Versus score' },
  { id: 'goal', label: 'Goal / progress' },
] as const

export function LiveFeedElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const preset = element.liveFeedPreset ?? 'single'
  const [copied, setCopied] = useState(false)

  const controlPath = `/live/${element.id}?step=${element.liveFeedStep ?? 1}`
  const controlUrl = typeof window !== 'undefined' ? `${window.location.origin}${controlPath}` : controlPath

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(controlUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked */ }
  }

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border-2 bg-white p-4 cursor-pointer transition-colors ${isSelected ? 'border-primary' : 'border-slate-200'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Radio className="w-4 h-4 text-primary" /> Live Feed
        </span>
        <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="p-1 text-slate-400 hover:text-red-500" aria-label="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Preset dropdown — the "tracker" selector */}
      <label className="block text-xs font-medium text-slate-500 mb-1">Tracker</label>
      <select
        value={preset}
        onChange={(e) => onChange({ liveFeedPreset: e.target.value as 'single' | 'versus' | 'goal' })}
        onClick={(e) => e.stopPropagation()}
        className="w-full mb-3 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
      >
        {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>

      <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
      <input
        value={element.liveFeedTitle ?? ''}
        onChange={(e) => onChange({ liveFeedTitle: e.target.value })}
        onClick={(e) => e.stopPropagation()}
        className="w-full mb-3 px-3 py-2 border border-slate-200 rounded-lg text-sm"
        placeholder="Title"
      />

      {preset === 'versus' && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input value={element.liveFeedLabelA ?? ''} onChange={(e) => onChange({ liveFeedLabelA: e.target.value })} onClick={(e) => e.stopPropagation()} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Home label" />
          <input value={element.liveFeedLabelB ?? ''} onChange={(e) => onChange({ liveFeedLabelB: e.target.value })} onClick={(e) => e.stopPropagation()} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Away label" />
        </div>
      )}

      {preset === 'single' && (
        <input value={element.liveFeedLabelA ?? ''} onChange={(e) => onChange({ liveFeedLabelA: e.target.value })} onClick={(e) => e.stopPropagation()} className="w-full mb-3 px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Value label (e.g. Reps)" />
      )}

      {preset === 'goal' && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input value={element.liveFeedLabelA ?? ''} onChange={(e) => onChange({ liveFeedLabelA: e.target.value })} onClick={(e) => e.stopPropagation()} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Label" />
          <input type="number" value={element.liveFeedTarget ?? 0} onChange={(e) => onChange({ liveFeedTarget: Number(e.target.value) })} onClick={(e) => e.stopPropagation()} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Target" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Step</label>
          <input type="number" min={1} value={element.liveFeedStep ?? 1} onChange={(e) => onChange({ liveFeedStep: Math.max(1, Number(e.target.value)) })} onClick={(e) => e.stopPropagation()} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Color</label>
          <input type="color" value={element.liveFeedColor ?? '#39D98A'} onChange={(e) => onChange({ liveFeedColor: e.target.value })} onClick={(e) => e.stopPropagation()} className="w-full h-9 px-1 border border-slate-200 rounded-lg" />
        </div>
      </div>

      {/* Control-from-phone panel */}
      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
          <Smartphone className="w-3.5 h-3.5" /> Control live from your phone
        </div>
        <p className="text-[11px] text-slate-500 mb-2">Save the page first, then open this link on your phone to go live.</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate text-[11px] bg-white border border-slate-200 rounded px-2 py-1.5">{controlUrl}</code>
          <button onClick={(e) => { e.stopPropagation(); copyLink() }} className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700" aria-label="Copy link">
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <a href={controlPath} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">Open</a>
        </div>
      </div>
    </div>
  )
}
