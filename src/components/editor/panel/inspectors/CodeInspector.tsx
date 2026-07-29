'use client'
import type { InspectorProps } from './DefaultInspector'
import { CODE_LANGUAGES } from '@/components/elements/CodeElement'

const FIELD = 'mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary'

export function CodeInspector({ element, onChange }: InspectorProps) {
  const theme = element.codeTheme ?? 'dark'

  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Language
        <select value={element.codeLanguage ?? 'javascript'} className={FIELD}
          onChange={(e) => onChange({ codeLanguage: e.target.value })}>
          {CODE_LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </label>

      <div className="text-xs text-muted-foreground">
        Theme
        <div className="mt-1 flex gap-1">
          {(['dark', 'light'] as const).map((t) => (
            <button key={t} type="button" aria-pressed={theme === t}
              onClick={() => onChange({ codeTheme: t })}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md border capitalize transition ${
                theme === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="rounded" checked={element.codeShowLineNumbers ?? true}
          onChange={(e) => onChange({ codeShowLineNumbers: e.target.checked })} />
        Show line numbers
      </label>

      <label className="block text-xs text-muted-foreground">
        Filename
        <input type="text" value={element.codeFilename ?? ''} placeholder="e.g., app.tsx" className={FIELD}
          onChange={(e) => onChange({ codeFilename: e.target.value })} />
      </label>

      <p className="text-[11px] text-muted-foreground/70 border-t border-border pt-2">
        The code itself is edited on the card.
      </p>
    </div>
  )
}
