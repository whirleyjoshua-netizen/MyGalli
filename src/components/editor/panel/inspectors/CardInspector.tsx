'use client'
import type { InspectorProps } from './DefaultInspector'
import { CARD_PROVIDERS } from '@/lib/cards/registry'
import type { CardField } from '@/lib/cards/registry'

const FIELD = 'mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary'
const STYLES = ['default', 'compact', 'detailed'] as const

export function CardInspector({ element, onChange }: InspectorProps) {
  const provider = element.cardProvider || 'vouch'
  const data = element.cardData || {}
  const style = element.cardStyle || 'default'
  const config = CARD_PROVIDERS[provider]

  const changeProvider = (next: string) => {
    const cfg = CARD_PROVIDERS[next]
    if (!cfg) return
    onChange({ cardProvider: next, cardData: { ...cfg.defaultData }, cardStyle: 'default' })
  }

  const changeField = (key: string, value: unknown) =>
    onChange({ cardData: { ...data, [key]: value } })

  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Provider
        <select value={provider} className={FIELD} onChange={(e) => changeProvider(e.target.value)}>
          {Object.values(CARD_PROVIDERS).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>

      <div className="text-xs text-muted-foreground">
        Style
        <div className="mt-1 flex gap-1">
          {STYLES.map((s) => (
            <button key={s} type="button" aria-pressed={style === s}
              onClick={() => onChange({ cardStyle: s })}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md border capitalize transition ${
                style === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {config && (
        <div className="space-y-2 border-t border-border pt-2">
          <div className="text-xs text-muted-foreground">Card data</div>
          {config.fields.map((field: CardField) => (
            <label key={field.key} className="block text-xs text-muted-foreground">
              {field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}
              {field.type === 'textarea' ? (
                <textarea value={String(data[field.key] ?? '')} rows={2} placeholder={field.placeholder}
                  className={`${FIELD} resize-none`}
                  onChange={(e) => changeField(field.key, e.target.value)} />
              ) : field.type === 'number' ? (
                <input type="number" value={String(data[field.key] ?? '')} placeholder={field.placeholder}
                  className={FIELD}
                  onChange={(e) => changeField(field.key, parseInt(e.target.value) || 0)} />
              ) : (
                <input type={field.type === 'url' ? 'url' : 'text'} value={String(data[field.key] ?? '')}
                  placeholder={field.placeholder} className={FIELD}
                  onChange={(e) => changeField(field.key, e.target.value)} />
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
