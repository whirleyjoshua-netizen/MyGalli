'use client'

import { Trash2, Inbox } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { PublicMailboxElement } from './PublicMailboxElement'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function MailboxElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const field = (label: string, key: keyof CanvasElement, placeholder = '') => (
    <label className="block">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <input
        value={(element[key] as string) ?? ''}
        onChange={(e) => onChange({ [key]: e.target.value } as Partial<CanvasElement>)}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        className="mt-0.5 w-full text-sm border border-border rounded-lg px-2 py-1.5"
      />
    </label>
  )

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      className={`relative rounded-xl border-2 bg-white p-4 cursor-pointer ${isSelected ? 'border-primary' : 'border-slate-200'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Inbox className="w-4 h-4 text-primary" /> Mailbox</span>
        <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="p-1 text-slate-400 hover:text-red-500" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
      </div>

      <div className="space-y-2">
        {field('Title', 'mailboxTitle')}
        {field('Prompt', 'mailboxPrompt')}
        {field('Button label', 'mailboxButtonLabel')}
        {field('Thank-you message', 'mailboxThankYou')}
        <div className="flex items-center gap-4 pt-1">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={element.mailboxAllowAudio ?? true} onChange={(e) => onChange({ mailboxAllowAudio: e.target.checked })} onClick={(e) => e.stopPropagation()} /> Allow audio
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={element.mailboxRequireName ?? false} onChange={(e) => onChange({ mailboxRequireName: e.target.checked })} onClick={(e) => e.stopPropagation()} /> Require name
          </label>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">Preview</div>
        <div className="pointer-events-none"><PublicMailboxElement element={element} /></div>
      </div>
    </div>
  )
}
