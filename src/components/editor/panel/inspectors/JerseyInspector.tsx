'use client'
import type { InspectorProps } from './DefaultInspector'

const FIELD = 'mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary'
const STYLES = ['classic', 'modern', 'retro'] as const

export function JerseyInspector({ element, onChange }: InspectorProps) {
  const style = element.jerseyStyle ?? 'classic'
  const primary = element.jerseyPrimaryColor ?? '#39D98A'
  const secondary = element.jerseySecondaryColor ?? '#0F3D2E'

  return (
    <div className="px-3 py-2 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-muted-foreground">
          Number
          <input type="text" maxLength={3} value={element.jerseyNumber ?? ''} className={`${FIELD} text-center font-bold`}
            onChange={(e) => onChange({ jerseyNumber: e.target.value })} />
        </label>
        <label className="block text-xs text-muted-foreground">
          Name
          <input type="text" maxLength={20} value={element.jerseyName ?? ''} className={`${FIELD} uppercase`}
            onChange={(e) => onChange({ jerseyName: e.target.value })} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-muted-foreground">
          Primary colour
          <input type="color" value={primary} className="mt-1 h-8 w-full rounded-md border border-border cursor-pointer"
            onChange={(e) => onChange({ jerseyPrimaryColor: e.target.value })} />
        </label>
        <label className="block text-xs text-muted-foreground">
          Secondary colour
          <input type="color" value={secondary} className="mt-1 h-8 w-full rounded-md border border-border cursor-pointer"
            onChange={(e) => onChange({ jerseySecondaryColor: e.target.value })} />
        </label>
      </div>

      <div className="text-xs text-muted-foreground">
        Style
        <div className="mt-1 flex gap-1">
          {STYLES.map((s) => (
            <button key={s} type="button" aria-pressed={style === s}
              onClick={() => onChange({ jerseyStyle: s })}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md border capitalize transition ${
                style === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="rounded" checked={element.jerseySignaturesEnabled !== false}
          onChange={(e) => onChange({ jerseySignaturesEnabled: e.target.checked })} />
        Fan signatures
      </label>
      <p className="text-[11px] text-muted-foreground/70 -mt-1">Allow visitors to sign your jersey.</p>
    </div>
  )
}
