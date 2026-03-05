'use client'

import { UtensilsCrossed } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

const TAG_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  popular: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Popular' },
  new: { bg: 'bg-green-100', text: 'text-green-700', label: 'New' },
  vegan: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Vegan' },
  gf: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'GF' },
  spicy: { bg: 'bg-red-100', text: 'text-red-700', label: 'Spicy' },
}

export function PublicBusinessMenuElement({ element }: Props) {
  const categories = element.bizMenuCategories ?? []
  const currency = element.bizMenuCurrency ?? '$'

  if (categories.length === 0) return null

  return (
    <div className="space-y-6">
      {element.bizMenuTitle && (
        <div className="flex items-center gap-2 text-lg font-bold text-foreground">
          <UtensilsCrossed className="w-5 h-5 text-amber-500" />
          {element.bizMenuTitle}
        </div>
      )}

      {categories.map((cat, catIdx) => (
        <div key={catIdx} className="space-y-3">
          <h3 className="text-base font-semibold text-foreground border-b border-border pb-2">
            {cat.name}
          </h3>
          <div className="space-y-2">
            {cat.items.map((item, itemIdx) => (
              <div key={itemIdx} className="flex gap-3 p-3 rounded-lg hover:bg-muted/30 transition group">
                {item.image && (
                  <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{item.name}</span>
                      {item.tags.map(tag => {
                        const style = TAG_STYLES[tag]
                        return style ? (
                          <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                        ) : null
                      })}
                    </div>
                    <span className="font-semibold text-sm text-amber-600 whitespace-nowrap">
                      {currency}{item.price}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
