import { Heart } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { safeHref } from '@/lib/editor/safe-href'

export function PublicTipJarElement({ element }: { element: CanvasElement }) {
  const href = safeHref(element.tipJarUrl)
  const amounts = (element.tipJarAmounts || []).filter(Boolean)
  return (
    <div className="max-w-md mx-auto rounded-2xl border border-border bg-surface p-5 text-center space-y-3">
      {element.tipJarTitle && <h3 className="text-lg font-bold">{element.tipJarTitle}</h3>}
      {element.tipJarMessage && <p className="text-sm text-muted-foreground">{element.tipJarMessage}</p>}
      {amounts.length > 0 && (
        <div className="flex justify-center gap-2 flex-wrap">
          {amounts.map((a, i) => (
            href
              ? <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-full border border-border text-sm font-medium hover:border-primary transition">{a}</a>
              : <span key={i} className="px-3 py-1.5 rounded-full border border-border text-sm font-medium text-muted-foreground">{a}</span>
          ))}
        </div>
      )}
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition">
          <Heart className="w-4 h-4" /> {element.tipJarButtonText || 'Leave a tip'}
        </a>
      )}
    </div>
  )
}
