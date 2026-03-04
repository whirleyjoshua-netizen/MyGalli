import { ShoppingCart, Target, Plane, Gift, ExternalLink } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

const typeIcons: Record<string, typeof ShoppingCart> = {
  amazon: ShoppingCart,
  target: Target,
  honeymoon: Plane,
  custom: Gift,
}

const typeLabels: Record<string, string> = {
  amazon: 'Amazon',
  target: 'Target',
  honeymoon: 'Honeymoon Fund',
  custom: 'Registry',
}

export function PublicWeddingRegistryElement({ element }: Props) {
  const title = element.weddingRegistryTitle || 'Our Registry'
  const items = element.weddingRegistryItems || []

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E8B4B8]/30 bg-white/50 p-8 text-center">
        <Gift className="w-8 h-8 mx-auto mb-2 text-[#E8B4B8]/50" />
        <p className="text-sm text-muted-foreground">No registry links yet</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[#E8B4B8]/30 bg-white/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E8B4B8]/20 flex items-center gap-2">
        <Gift className="w-5 h-5 text-[#E8B4B8]" />
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>

      {/* Grid of registry cards */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((item, i) => {
          const Icon = typeIcons[item.type] || Gift

          return (
            <div
              key={i}
              className="group rounded-xl border border-[#E8B4B8]/20 bg-white p-5 hover:shadow-md hover:border-[#E8B4B8]/40 transition-all"
            >
              {/* Icon & type badge */}
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-full bg-[#E8B4B8]/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[#E8B4B8]" />
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-[#E8B4B8] bg-[#E8B4B8]/10 px-2 py-0.5 rounded-full">
                  {typeLabels[item.type] || 'Registry'}
                </span>
              </div>

              {/* Name */}
              <h4 className="font-semibold text-sm mb-1">{item.name || 'Untitled Registry'}</h4>

              {/* Description */}
              {item.description && (
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  {item.description}
                </p>
              )}

              {/* Link button */}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full bg-[#E8B4B8] text-white hover:bg-[#D9A0A5] transition-colors"
                >
                  View Registry
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
