'use client'

import { Trash2, Plus, X, DollarSign } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function RateCardElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const packages = element.rateCardPackages ?? []

  const updatePkg = (index: number, field: string, value: any) => {
    const updated = [...packages]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ rateCardPackages: updated })
  }

  const addPkg = () => {
    onChange({
      rateCardPackages: [...packages, { name: 'New Package', description: '', deliverables: [''], price: '$0', highlight: false }],
    })
  }

  const removePkg = (index: number) => {
    onChange({ rateCardPackages: packages.filter((_, i) => i !== index) })
  }

  const addDeliverable = (pkgIndex: number) => {
    const updated = [...packages]
    updated[pkgIndex] = { ...updated[pkgIndex], deliverables: [...updated[pkgIndex].deliverables, ''] }
    onChange({ rateCardPackages: updated })
  }

  const updateDeliverable = (pkgIndex: number, delIndex: number, value: string) => {
    const updated = [...packages]
    const deliverables = [...updated[pkgIndex].deliverables]
    deliverables[delIndex] = value
    updated[pkgIndex] = { ...updated[pkgIndex], deliverables }
    onChange({ rateCardPackages: updated })
  }

  const removeDeliverable = (pkgIndex: number, delIndex: number) => {
    const updated = [...packages]
    updated[pkgIndex] = {
      ...updated[pkgIndex],
      deliverables: updated[pkgIndex].deliverables.filter((_, i) => i !== delIndex),
    }
    onChange({ rateCardPackages: updated })
  }

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-[#E040FB] border-[#E040FB]/30' : 'border-border hover:border-[#E040FB]/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-[#E040FB]" />
          <input
            type="text"
            value={element.rateCardTitle ?? 'Packages & Rates'}
            onChange={(e) => onChange({ rateCardTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold bg-transparent border-none outline-none"
          />
        </div>

        <div className="space-y-3">
          {packages.map((pkg, i) => (
            <div key={i} className={`bg-muted/50 rounded-lg p-3 space-y-2 ${pkg.highlight ? 'ring-1 ring-[#E040FB]/40' : ''}`}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={pkg.name}
                  onChange={(e) => updatePkg(i, 'name', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Package name"
                  className="flex-1 text-sm font-medium bg-transparent border-none outline-none"
                />
                <input
                  type="text"
                  value={pkg.price}
                  onChange={(e) => updatePkg(i, 'price', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="$0"
                  className="w-24 text-sm font-bold text-right bg-transparent border-none outline-none text-[#E040FB]"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); removePkg(i) }}
                  className="p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <input
                type="text"
                value={pkg.description ?? ''}
                onChange={(e) => updatePkg(i, 'description', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Description"
                className="w-full text-xs bg-transparent border border-border rounded px-2 py-1 outline-none"
              />
              <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground font-semibold uppercase">Deliverables</div>
                {pkg.deliverables.map((del, di) => (
                  <div key={di} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={del}
                      onChange={(e) => updateDeliverable(i, di, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Deliverable"
                      className="flex-1 text-xs bg-transparent border border-border rounded px-2 py-0.5 outline-none"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); removeDeliverable(i, di) }}
                      className="p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={(e) => { e.stopPropagation(); addDeliverable(i) }}
                  className="text-[10px] text-[#E040FB] font-medium"
                >
                  + deliverable
                </button>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={!!pkg.highlight}
                  onChange={(e) => updatePkg(i, 'highlight', e.target.checked)}
                  className="rounded border-border"
                />
                Featured package
              </label>
            </div>
          ))}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); addPkg() }}
          className="flex items-center gap-1.5 text-sm text-[#E040FB] hover:text-[#c030d8] font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add package
        </button>
      </div>

      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
