'use client'
import { Lock } from 'lucide-react'
import type { InspectorProps } from './DefaultInspector'

export function SlideshowInspector({ element, onChange, isPro }: InspectorProps) {
  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Height (px)
        <input
          type="number"
          value={element.slideshowHeight ?? 400}
          onChange={(e) => onChange({ slideshowHeight: Number(e.target.value) })}
          className="mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={element.slideshowShowOverlay ?? true}
          onChange={(e) => onChange({ slideshowShowOverlay: e.target.checked })}
        />
        Show text overlay
      </label>

      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="uppercase tracking-wide text-muted-foreground">Advanced</span>
          {!isPro && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-galli-violet/10 text-galli-violet px-1.5 py-0.5 rounded">
              <Lock className="w-3 h-3" /> PRO
            </span>
          )}
        </div>
        {isPro ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Auto-rotation (daily / weekly / biweekly) and preset image sets will appear here.
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Upgrade your plan to unlock auto-rotation and preset image sets.
          </p>
        )}
      </div>
    </div>
  )
}
