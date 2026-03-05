'use client'

import { DollarSign, Check } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

export function PublicRateCardElement({ element }: Props) {
  const packages = element.rateCardPackages ?? []

  if (packages.length === 0) return null

  return (
    <div className="space-y-3">
      {element.rateCardTitle && (
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <DollarSign className="w-4 h-4 text-[#E040FB]" />
          {element.rateCardTitle}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map((pkg, i) => (
          <div
            key={i}
            className={`relative rounded-xl border bg-white overflow-hidden transition-shadow ${
              pkg.highlight
                ? 'border-[#E040FB] shadow-lg shadow-[#E040FB]/10'
                : 'border-border hover:shadow-md'
            }`}
          >
            {pkg.highlight && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E040FB] to-[#AB47BC]" />
            )}
            <div className="p-5">
              {pkg.highlight && (
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[#E040FB] bg-[#E040FB]/10 px-2 py-0.5 rounded-full mb-3">
                  Featured
                </span>
              )}
              <h4 className="font-semibold text-base">{pkg.name}</h4>
              {pkg.description && (
                <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>
              )}
              <div className="text-2xl font-bold mt-3 text-[#E040FB]">{pkg.price}</div>
              {pkg.deliverables.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {pkg.deliverables.filter(Boolean).map((del, di) => (
                    <li key={di} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-[#E040FB] mt-0.5 flex-shrink-0" />
                      <span>{del}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
