'use client'

import { Package, ExternalLink } from 'lucide-react'
import { safeHref } from '@/lib/editor/safe-href'
import type { CanvasElement, Product } from '@/lib/types/canvas'

export function PublicProductListElement({ element }: { element: CanvasElement }) {
  const products: Product[] = element.products ?? []
  const title = element.productListTitle?.trim()

  if (products.length === 0) {
    return <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-400 text-center">No products yet.</div>
  }

  return (
    <div>
      {title && <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => {
          const href = safeHref(p.buyUrl)
          return (
            <div key={p.id} className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-10 h-10 text-slate-300" />
                )}
              </div>
              <div className="flex flex-col flex-1 p-3">
                <p className="text-sm font-semibold text-slate-800 line-clamp-2">{p.title}</p>
                {p.price && <p className="mt-1 text-sm font-medium text-slate-900">{p.price}</p>}
                {p.description && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{p.description}</p>}
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition"
                  >
                    View <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
